import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ticketCategoryLabels } from "@/lib/ticket-categories";
import { approvedOrderStatus } from "@/lib/order-approvals";
import type { Prisma, OrderApprovalStatus, OrderApprovalType, OrderStatus } from "@/generated/prisma/client";
import { analyzeSentiment, detectIntent } from "./guardrails";
import { searchKnowledgeBase } from "./semantic-search";
import type { ToolDefinition } from "./types";

export interface ToolContext {
  conversationId: string;
  turnMessageId: string;
  verifiedCustomerId?: string;
  embeddingApiKey: string;
}

export interface ToolResult {
  success: boolean;
  code?: string;
  message?: string;
  customerReply?: string;
  [key: string]: unknown;
}

const activeTicketStatuses = ["open", "in_progress", "pending"];
const activeConversationStatuses = ["active", "open", "pending"];
const ticketSummary = { id: true, title: true, category: true, priority: true, status: true } satisfies Prisma.TicketSelect;
const ticketCategories = z.enum(Object.keys(ticketCategoryLabels) as Array<keyof typeof ticketCategoryLabels>);
const ticketPriorities = z.enum(["low", "medium", "high", "urgent"]);
const shortText = z.string().trim().min(1).max(160);
const longText = z.string().trim().min(1).max(4000);
const orderNumber = z.string().trim().min(1).max(100);
const orderInput = z.strictObject({ orderNumber });
const ticketInput = z.strictObject({
  title: shortText,
  description: longText,
  category: ticketCategories.optional(),
  priority: ticketPriorities.optional(),
  department: shortText.optional(),
  orderNumber: orderNumber.optional(),
});
const ticketUpdateInput = z.strictObject({
  ticketId: shortText,
  title: shortText.optional(),
  description: longText.optional(),
  category: ticketCategories.optional(),
  priority: ticketPriorities.optional(),
  status: z.enum(["open", "in_progress", "pending", "resolved"]).optional(),
});
const escalationInput = z.strictObject({
  reason: longText,
  ticketId: shortText.optional(),
});
const approvalInput = z.strictObject({
  orderNumber,
  type: z.enum(["refund", "cancellation"]),
  reason: longText,
});

const orderNotFound = {
  success: false,
  code: "ORDER_NOT_FOUND",
  message: "No matching order was found for this account.",
} as const;
const ticketNotFound: ToolResult = {
  success: false,
  code: "TICKET_NOT_FOUND",
  message: "No matching open ticket was found in this conversation.",
};
const verifiedAccountRequired: ToolResult = {
  success: false,
  code: "VERIFIED_CUSTOMER_REQUIRED",
  message: "Ask the customer to sign in to the customer portal for this request.",
};
const inactiveConversation = {
  success: false,
  code: "CONVERSATION_CLOSED",
  message: "This conversation is no longer available for this action.",
} as const;
const ineligibleOrder = {
  success: false,
  code: "ORDER_INELIGIBLE",
  message: "This order state is ineligible for the requested action.",
} as const;

function defineTool<T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  run: (args: z.output<T>, context: ToolContext) => Promise<ToolResult>,
  verifiedOnly = false,
) {
  const parameters = z.toJSONSchema(schema, { target: "draft-7", io: "input" });
  delete parameters.$schema;

  const definition: ToolDefinition = {
    type: "function",
    function: { name, description, parameters },
  };

  return {
    definition,
    verifiedOnly,
    async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
      const result = schema.safeParse(args);
      if (!result.success) {
        return { success: false, code: "INVALID_ARGUMENTS", message: "Supply valid inputs for this tool." };
      }
      return run(result.data, context);
    },
  };
}

const tools = [
  defineTool(
    "search_knowledge",
    "Find relevant NovaCart policies and FAQs with source IDs and titles. Use for business questions, including when the initial documents do not answer the question.",
    z.strictObject({ query: z.string().trim().min(3).max(500) }),
    async ({ query }, context) => {
      const sources = await searchKnowledgeBase(query, 5, context.embeddingApiKey);
      return {
        success: true,
        sources: sources.map(({ id, title, category, content }) => ({ id, title, category, content: content.slice(0, 3000) })),
      };
    },
  ),
  defineTool(
    "get_customer_history",
    "Retrieve recent support conversations for the currently authenticated customer. This tool accepts no account identifier.",
    z.strictObject({}),
    async (_, context) => {
      const history = await prisma.conversation.findMany({
        where: {
          customerId: context.verifiedCustomerId,
          channel: "web",
          id: { not: context.conversationId },
        },
        select: {
          status: true,
          summary: true,
          createdAt: true,
          messages: { where: { role: { in: ["customer", "assistant"] } }, select: { role: true, content: true }, orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      return {
        success: true,
        history: history.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) => ({ ...message, content: message.content.slice(0, 400) })),
        })),
      };
    },
    true,
  ),
  defineTool(
    "lookup_order",
    "Look up the real order details for an order number supplied by the currently authenticated customer.",
    orderInput,
    async ({ orderNumber }, context) => {
      const order = await prisma.order.findFirst({
        where: { number: orderNumber, customerId: context.verifiedCustomerId },
        select: { number: true, status: true, currency: true, totalMinor: true, placedAt: true },
      });
      if (!order) return orderNotFound;
      const total = formatOrderTotal(order.totalMinor, order.currency);
      return {
        success: true,
        order,
        customerReply: [
          `Order ${order.number} is ${order.status}. Placed on ${dateLabel(order.placedAt)}.`,
          total && `Order total: ${total}.`,
        ].filter(Boolean).join(" "),
      };
    },
    true,
  ),
  defineTool(
    "track_delivery",
    "Check stored shipment status, carrier, tracking number, and dates for the authenticated customer's order. Ask for the order number if it is missing.",
    orderInput,
    async ({ orderNumber }, context) => {
      const order = await prisma.order.findFirst({
        where: { number: orderNumber, customerId: context.verifiedCustomerId },
        select: {
          number: true,
          status: true,
          delivery: { select: { status: true, carrier: true, trackingNumber: true, estimatedDeliveryAt: true, deliveredAt: true } },
        },
      });
      if (!order) return orderNotFound;
      const { delivery } = order;
      const customerReply = delivery
        ? [
          `Shipment for order ${order.number}: ${delivery.status.replaceAll("_", " ")}.`,
          delivery.carrier && `Carrier: ${delivery.carrier}.`,
          delivery.trackingNumber && `Tracking number: ${delivery.trackingNumber}.`,
          delivery.deliveredAt
            ? `Delivered on ${dateLabel(delivery.deliveredAt)}.`
            : delivery.estimatedDeliveryAt && `Estimated delivery: ${dateLabel(delivery.estimatedDeliveryAt)}.`,
        ].filter(Boolean).join(" ")
        : `There is no shipment record for order ${order.number} yet. Order status: ${order.status}.`;
      return {
        success: true,
        orderNumber: order.number,
        orderStatus: order.status,
        delivery,
        customerReply,
      };
    },
    true,
  ),
  defineTool(
    "list_open_tickets",
    "List open support tickets for the current conversation before updating or escalating an existing issue.",
    z.strictObject({}),
    async (_, context) => ({
      success: true,
      tickets: await prisma.ticket.findMany({
        where: { conversationId: context.conversationId, status: { in: activeTicketStatuses } },
        select: ticketSummary,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    }),
  ),
  defineTool(
    "create_ticket",
    "Create a persistent support ticket for this conversation. Supply the known issue category and priority when possible. Link an order only with the customer's confirmed order number.",
    ticketInput,
    createTicket,
  ),
  defineTool(
    "update_ticket",
    "Update a current conversation's open ticket with meaningful detail, category, priority, or status. Resolve it only when the issue is resolved. Use list_open_tickets to find an existing ticket ID.",
    ticketUpdateInput,
    updateTicket,
  ),
  defineTool(
    "escalate_to_human",
    "Place the current conversation in the human review queue for an unresolved complaint, requested human help, or issue requiring staff intervention. If a ticket already exists, pass its ID.",
    escalationInput,
    escalateConversation,
  ),
  defineTool(
    "request_order_approval",
    "Check eligibility for an explicit refund or cancellation request and direct the customer to confirm in My orders. This never submits an approval request or changes an order.",
    approvalInput,
    proposeOrderApproval,
    true,
  ),
];

export function availableTools(context: ToolContext): ToolDefinition[] {
  return tools
    .filter((tool) => !tool.verifiedOnly || !!context.verifiedCustomerId)
    .map((tool) => tool.definition);
}

export async function executeToolCall(name: string, args: unknown, context: ToolContext): Promise<ToolResult> {
  const tool = tools.find(({ definition }) => definition.function.name === name);
  if (!tool) {
    return { success: false, code: "UNKNOWN_TOOL", message: "This tool is unavailable." };
  }
  if (tool.verifiedOnly && !context.verifiedCustomerId) return verifiedAccountRequired;

  try {
    return await tool.execute(args, context);
  } catch (error) {
    logger.error("AI tool failed", undefined, {
      tool: name,
      conversationId: context.conversationId,
      errorType: error instanceof Error ? error.name : "Unknown error",
    });
    return { success: false, code: "TOOL_FAILED", message: "The operation could not be completed." };
  }
}

function audit(
  tx: Prisma.TransactionClient,
  context: { verifiedCustomerId?: string; conversationId?: string; turnMessageId?: string },
  action: string,
  entity: string,
  entityId: string,
  description: string,
  userName = "SupportOps AI",
) {
  return tx.activityLog.create({
    data: {
      action, entity, entityId, description,
      userName,
      userId: context.verifiedCustomerId,
      requestId: context.turnMessageId,
      metadata: context.conversationId ? { conversationId: context.conversationId } : {},
    },
  });
}

function dateLabel(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatOrderTotal(totalMinor: number, currency: string): string | undefined {
  if (!/^[a-z]{3}$/i.test(currency)) return;
  const format = new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" });
  const fractionDigits = format.resolvedOptions().maximumFractionDigits ?? 0;
  return format.format(totalMinor / 10 ** fractionDigits);
}

function conversationIdentity(id: string, verifiedCustomerId?: string): Prisma.ConversationWhereInput {
  return {
    id,
    ...(verifiedCustomerId
      ? { customerId: verifiedCustomerId, channel: "web" }
      : { channel: { not: "web" } }),
  };
}

async function lockActiveConversation(tx: Prisma.TransactionClient, id: string, verifiedCustomerId?: string) {
  const { count } = await tx.conversation.updateMany({
    where: { ...conversationIdentity(id, verifiedCustomerId), status: { in: activeConversationStatuses } },
    data: { updatedAt: new Date() },
  });
  return count > 0;
}

async function createTicket(args: z.output<typeof ticketInput>, context: ToolContext): Promise<ToolResult> {
  if (args.orderNumber && !context.verifiedCustomerId) return verifiedAccountRequired;

  return prisma.$transaction(async (tx) => {
    // Serialize writes for this conversation with concurrent close and handoff operations.
    if (!await lockActiveConversation(tx, context.conversationId, context.verifiedCustomerId)) return inactiveConversation;

    const order = args.orderNumber ? await tx.order.findFirst({
      where: { number: args.orderNumber, customerId: context.verifiedCustomerId },
      select: { id: true },
    }) : undefined;
    if (args.orderNumber && !order) return orderNotFound;

    const department = args.department ? await tx.department.findFirst({
      where: { name: { equals: args.department, mode: "insensitive" } },
      select: { id: true },
    }) : undefined;

    const existing = await tx.ticket.findFirst({
      where: {
        conversationId: context.conversationId, orderId: order?.id ?? null,
        title: { equals: args.title, mode: "insensitive" }, status: { in: activeTicketStatuses },
      },
      select: ticketSummary,
    });
    if (existing) return { success: true, ticket: existing, reused: true };

    const issue = `${args.title} ${args.description}`;
    const intent = detectIntent(issue).intent;
    const category = args.category ?? (intent === "complaint" ? "complaint" : intent === "billing" ? "billing" : order ? "order" : "general");
    const priority = args.priority ?? (category === "complaint" || analyzeSentiment(issue).sentiment === "negative" ? "high" : "medium");
    const ticket = await tx.ticket.create({
      data: {
        title: args.title, description: args.description, category, priority,
        conversationId: context.conversationId, orderId: order?.id, departmentId: department?.id,
      },
      select: ticketSummary,
    });
    await audit(tx, context, "ticket.created", "ticket", ticket.id, "AI created a support ticket.");
    return { success: true, ticket };
  });
}

async function updateTicket(args: z.output<typeof ticketUpdateInput>, context: ToolContext): Promise<ToolResult> {
  const { ticketId, ...data } = args;
  if (Object.keys(data).length === 0) {
    return { success: false, code: "INVALID_ARGUMENTS", message: "Provide at least one ticket field to update." };
  }

  return prisma.$transaction(async (tx) => {
    if (!await lockActiveConversation(tx, context.conversationId, context.verifiedCustomerId)) return inactiveConversation;
    const [ticket] = await tx.ticket.updateManyAndReturn({
      where: { id: ticketId, conversationId: context.conversationId, status: { in: activeTicketStatuses } },
      data,
      select: ticketSummary,
    });
    if (!ticket) return ticketNotFound;
    await audit(tx, context, "ticket.updated", "ticket", ticket.id, "AI updated a support ticket.");
    return { success: true, ticket };
  });
}

async function escalateConversation(
  args: z.output<typeof escalationInput>,
  context: { conversationId: string; verifiedCustomerId?: string; turnMessageId?: string },
  actor = "SupportOps AI",
): Promise<ToolResult> {
  return prisma.$transaction(async (tx) => {
    const identity = conversationIdentity(context.conversationId, context.verifiedCustomerId);
    const existing = args.ticketId ? await tx.ticket.findFirst({
      where: { id: args.ticketId, conversationId: context.conversationId, status: { in: activeTicketStatuses } },
      select: ticketSummary,
    }) : null;
    if (args.ticketId && !existing) return ticketNotFound;

    const changed = await tx.conversation.updateMany({
      where: {
        ...identity,
        status: { in: actor === "Customer portal" ? [...activeConversationStatuses, "resolved", "snoozed"] : activeConversationStatuses },
      },
      data: { status: "escalated" },
    });
    if (!changed.count) {
      const conversation = await tx.conversation.findFirst({
        where: identity,
        select: { status: true },
      });
      if (!conversation) return { success: false, code: "CONVERSATION_NOT_FOUND", message: "Conversation not found." };
      return conversation.status === "escalated"
        ? { success: true, status: "escalated", reused: true }
        : inactiveConversation;
    }

    const current = existing ?? await tx.ticket.findFirst({
      where: { conversationId: context.conversationId, status: { in: activeTicketStatuses } },
      orderBy: { createdAt: "desc" },
      select: ticketSummary,
    });
    const ticket = current ?? await tx.ticket.create({
      data: {
        conversationId: context.conversationId,
        title: "Human review requested",
        description: args.reason,
        category: "complaint",
        priority: "high",
      },
      select: ticketSummary,
    });
    await tx.internalNote.create({
      data: { conversationId: context.conversationId, authorName: actor, content: args.reason },
    });
    await audit(tx, context, "conversation.escalated", "conversation", context.conversationId, "Placed the conversation in the human review queue.", actor);
    return { success: true, status: "escalated", ticket };
  });
}

export async function requestHumanSupport(
  input: unknown,
  context: { conversationId: string; verifiedCustomerId: string },
): Promise<ToolResult> {
  const parsed = escalationInput.pick({ reason: true }).safeParse(input);
  if (!parsed.success) return { success: false, code: "INVALID_ARGUMENTS", message: "Provide a reason for human review." };
  return escalateConversation(parsed.data, context, "Customer portal");
}

async function proposeOrderApproval(args: z.output<typeof approvalInput>, context: ToolContext): Promise<ToolResult> {
  if (!context.verifiedCustomerId) return verifiedAccountRequired;
  const order = await prisma.order.findFirst({
    where: { number: args.orderNumber, customerId: context.verifiedCustomerId },
    select: { number: true, status: true },
  });
  if (!order) return orderNotFound;
  if (!approvedOrderStatus(order.status, args.type)) return ineligibleOrder;
  return {
    success: true,
    proposal: { orderNumber: order.number, type: args.type, reason: args.reason },
    customerReply: `You can request a ${args.type} for order ${order.number} in My orders. Enter your reason there and submit it for administrator review.`,
  };
}

type ApprovalConfirmation =
  | { success: true; approval: { id: string; status: OrderApprovalStatus; type: OrderApprovalType }; reused?: boolean }
  | { success: false; code: string; message: string };

export async function confirmOrderApproval(
  input: unknown,
  context: { verifiedCustomerId: string; conversationId?: string },
): Promise<ApprovalConfirmation> {
  const parsed = approvalInput.safeParse(input);
  if (!parsed.success) return { success: false, code: "INVALID_ARGUMENTS", message: "Provide an order number, request type, and reason." };
  const args = parsed.data;
  const { verifiedCustomerId: customerId, conversationId } = context;
  try {
    return await prisma.$transaction(async (tx): Promise<ApprovalConfirmation> => {
      if (conversationId && !await lockActiveConversation(tx, conversationId, customerId)) {
        return inactiveConversation;
      }
      // Serialize requests and administrator decisions on the same customer-owned order.
      const [order] = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
        SELECT id, status::text AS status FROM "Order"
        WHERE number = ${args.orderNumber} AND "customerId" = ${customerId}
        FOR UPDATE
      `;
      if (!order) return orderNotFound;

      const pendingKey = `${order.id}:${args.type}`;
      const select = { id: true, status: true, type: true } as const;
      const existing = await tx.orderApprovalRequest.findUnique({ where: { pendingKey }, select });
      if (existing) return { success: true, approval: existing, reused: true };

      if (!approvedOrderStatus(order.status, args.type)) return ineligibleOrder;

      const approval = await tx.orderApprovalRequest.create({
        data: {
          orderId: order.id,
          conversationId,
          type: args.type,
          reason: args.reason,
          pendingKey,
        },
        select,
      });
      await audit(tx, context, "approval.requested", "order_approval", approval.id, "Customer submitted an order action for administrator approval.", "Customer portal");
      return { success: true, approval };
    });
  } catch (error) {
    logger.error("Order approval request failed", undefined, {
      errorType: error instanceof Error ? error.name : "Unknown error",
    });
    return { success: false, code: "TOOL_FAILED", message: "The operation could not be completed." };
  }
}
