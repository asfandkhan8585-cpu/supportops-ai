import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmOrderApproval } from "@/lib/ai/tools";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { approvedOrderStatus } from "@/lib/order-approvals";
import { parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const approvalRequest = z.strictObject({
  orderNumber: z.string().trim().min(1).max(100),
  type: z.enum(["refund", "cancellation"]),
  reason: z.string().trim().min(1).max(2000),
  conversationId: z.uuid().optional(),
});

export async function GET(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const { skip, take } = parsePagination(new URL(request.url).searchParams);
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: [{ placedAt: "desc" }, { id: "desc" }],
    skip,
    take: take + 1,
    select: {
      number: true,
      status: true,
      placedAt: true,
      approvalRequests: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { type: true, status: true },
      },
      delivery: {
        select: {
          status: true,
          carrier: true,
          trackingNumber: true,
          estimatedDeliveryAt: true,
          deliveredAt: true,
        },
      },
    },
  });
  return NextResponse.json({
    hasMore: orders.length > take,
    orders: orders.slice(0, take).map(({ approvalRequests, ...order }) => ({
      ...order,
      latestRequest: approvalRequests[0] ?? null,
      availableAction: approvedOrderStatus(order.status, "refund")
        ? "refund"
        : approvedOrderStatus(order.status, "cancellation")
          ? "cancellation"
          : null,
    })),
  });
}

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Send the request as JSON." }, { status: 415 });
  }

  const parsed = approvalRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose an order action and enter a reason of up to 2,000 characters." },
      { status: 400 }
    );
  }
  const { conversationId, ...input } = parsed.data;
  const result = await confirmOrderApproval(input, {
    verifiedCustomerId: customer.id,
    conversationId,
  });
  if (!result.success) {
    const status =
      result.code === "ORDER_NOT_FOUND"
        ? 404
        : result.code === "ORDER_INELIGIBLE" || result.code === "CONVERSATION_CLOSED"
          ? 409
          : result.code === "INVALID_ARGUMENTS"
            ? 400
            : 503;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ approval: result.approval }, { status: result.reused ? 200 : 201 });
}
