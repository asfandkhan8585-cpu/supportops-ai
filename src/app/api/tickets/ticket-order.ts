import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ticketCategoryLabels } from "@/lib/ticket-categories";

export const ticketAssociationInput = z.object({
  category: z.enum(Object.keys(ticketCategoryLabels) as Array<keyof typeof ticketCategoryLabels>).optional(),
  orderNumber: z.string().trim().max(100).nullable().optional(),
  conversationId: z.string().nullable().optional(),
});

export const ticketOrder = { select: { id: true, number: true } } as const;

export async function resolveTicketOrder(
  db: Prisma.TransactionClient,
  { orderId, orderNumber, conversationId }: { orderId?: string | null; orderNumber?: string | null; conversationId?: string | null },
): Promise<{ orderId: string | null } | { error: string }> {
  const orderWhere = orderNumber === undefined
    ? orderId ? { id: orderId } : null
    : orderNumber ? { number: orderNumber } : null;
  if (!orderWhere) return { orderId: null };

  const order = await db.order.findUnique({
    where: orderWhere, select: { id: true, customerId: true },
  });
  if (!order) return { error: "Order not found." };

  if (conversationId) {
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId }, select: { customerId: true },
    });
    if (!conversation || conversation.customerId !== order.customerId) {
      return { error: "The order must belong to the customer in the linked conversation." };
    }
  }
  return { orderId: order.id };
}

export const associationError = "Use a valid ticket category and order number.";
