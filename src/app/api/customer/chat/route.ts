import { NextResponse } from "next/server";
import { z } from "zod";
import { chat, createNewConversation, CustomerConversationUnavailable } from "@/lib/ai/engine";
import { requestHumanSupport } from "@/lib/ai/tools";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { emitConversationUpdate } from "@/lib/realtime";

const chatInput = z.object({
  message: z.string().trim().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
});

const handoffInput = z.strictObject({ conversationId: z.uuid() });

function findConversation(customerId: string, id: string) {
  return prisma.conversation.findFirst({
    where: { id, customerId, channel: "web" },
    select: {
      id: true,
      status: true,
      messages: {
        where: { role: { in: ["customer", "assistant", "agent"] } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });
}

export async function GET(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (id !== null) {
    const conversation = await findConversation(customer.id, id);
    if (!conversation)
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ ...conversation, messages: conversation.messages.reverse() });
  }

  const conversations = await prisma.conversation.findMany({
    where: { customerId: customer.id, channel: "web" },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      messages: {
        where: { role: "customer" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });
  return NextResponse.json({
    conversations: conversations.map(({ messages, ...conversation }) => ({
      ...conversation,
      title: messages[0]?.content.slice(0, 80) || "Support conversation",
    })),
  });
}

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Send the message as JSON." }, { status: 415 });
  }

  const input = chatInput.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json(
      { error: "Enter a message of up to 10,000 characters." },
      { status: 400 }
    );
  }

  const { conversationId, message } = input.data;
  let id = conversationId;
  try {
    if (id) {
      const conversation = await prisma.conversation.findFirst({
        where: { id, customerId: customer.id, channel: "web" },
        select: { status: true },
      });
      if (!conversation)
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      if (conversation.status === "closed") {
        return NextResponse.json(
          { error: "Start a new conversation to contact support." },
          { status: 409 }
        );
      }
    } else {
      id = (await createNewConversation("web", customer.name, "", customer.id)).id;
    }

    await chat(id, message, { verifiedCustomerId: customer.id });
    const conversation = await findConversation(customer.id, id);
    if (!conversation)
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ ...conversation, messages: conversation.messages.reverse() });
  } catch (error) {
    if (error instanceof CustomerConversationUnavailable) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("Customer chat failed", error);
    return NextResponse.json(
      { error: "Support chat is temporarily unavailable.", conversationId: id },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Send the request as JSON." }, { status: 415 });
  }
  const input = handoffInput.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Choose a conversation first." }, { status: 400 });

  const { conversationId } = input.data;
  try {
    const result = await requestHumanSupport(
      { reason: "The customer requested human support in the portal." },
      {
        verifiedCustomerId: customer.id,
        conversationId,
      }
    );
    if (!result.success) {
      const status =
        result.code === "CONVERSATION_NOT_FOUND"
          ? 404
          : result.code === "CONVERSATION_CLOSED"
            ? 409
            : 503;
      return NextResponse.json({ error: result.message }, { status });
    }
    if (!result.reused) emitConversationUpdate(conversationId, { status: "escalated" });
    const conversation = await findConversation(customer.id, conversationId);
    if (!conversation)
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ ...conversation, messages: conversation.messages.reverse() });
  } catch (error) {
    logger.error("Customer handoff failed", error);
    return NextResponse.json(
      { error: "Could not request human support. Please try again." },
      { status: 503 }
    );
  }
}
