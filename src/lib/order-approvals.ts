import type { OrderApprovalType, OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function approvedOrderStatus(
  status: OrderStatus,
  type: OrderApprovalType
): OrderStatus | null {
  if (type === "refund") return status === "delivered" ? "refunded" : null;
  return status === "pending" || status === "confirmed" ? "cancelled" : null;
}

export async function decideOrderApproval(
  id: string,
  decision: "approve" | "reject",
  admin: { id: string; name: string }
) {
  return prisma.$transaction(async (tx) => {
    const reference = await tx.orderApprovalRequest.findUnique({
      where: { id },
      select: { orderId: true },
    });
    if (!reference) return { code: "NOT_FOUND" } as const;

    // Customer confirmations and administrator decisions acquire the same order lock.
    const [order] = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
      SELECT id, status::text AS status FROM "Order" WHERE id = ${reference.orderId} FOR UPDATE
    `;
    if (!order) return { code: "NOT_FOUND" } as const;

    const select = { id: true, type: true, status: true } as const;
    const current = await tx.orderApprovalRequest.findUnique({ where: { id }, select });
    if (!current) return { code: "NOT_FOUND" } as const;

    const status = decision === "approve" ? "approved" : "rejected";
    if (current.status === status) {
      return { approval: current, orderStatus: order.status, reused: true } as const;
    }
    if (current.status !== "pending") return { code: "ALREADY_DECIDED" } as const;

    const target =
      decision === "approve" ? approvedOrderStatus(order.status, current.type) : order.status;
    if (!target) return { code: "ORDER_INELIGIBLE" } as const;
    const savedOrder =
      decision === "approve"
        ? await tx.order.update({
            where: { id: order.id },
            data: { status: target },
            select: { status: true },
          })
        : order;
    const approval = await tx.orderApprovalRequest.update({
      where: { id },
      data: { status, pendingKey: null },
      select,
    });

    await tx.activityLog.create({
      data: {
        action: `approval.${approval.status}`,
        entity: "order_approval",
        entityId: approval.id,
        description:
          decision === "approve"
            ? `Administrator approved the ${approval.type} and updated the order status to ${savedOrder.status}.`
            : `Administrator rejected the ${approval.type} request.`,
        userId: admin.id,
        userName: admin.name,
        metadata: {
          orderId: order.id,
          previousOrderStatus: order.status,
          orderStatus: savedOrder.status,
        },
      },
    });
    return { approval, orderStatus: savedOrder.status, reused: false } as const;
  });
}
