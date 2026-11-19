import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import type { Prisma } from "@/generated/prisma/client";
import { associationError, resolveTicketOrder, ticketAssociationInput, ticketOrder } from "../ticket-order";

const ticketDetails = {
  order: ticketOrder,
  conversation: {
    select: { id: true, customerName: true, customerContact: true, channel: true, status: true },
  },
  department: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TicketInclude;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "tickets:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: ticketDetails,
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(ticket);
  } catch (error) {
    logger.error("Failed to fetch ticket:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "tickets:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const association = ticketAssociationInput.safeParse(body);
    if (!association.success) return NextResponse.json({ error: associationError }, { status: 400 });
    const { category, orderNumber, conversationId } = association.data;
    const {
      title,
      description,
      status,
      priority,
      resolution,
      departmentId,
      assignedToId,
    } = body;

    const associationChanged = orderNumber !== undefined || conversationId !== undefined;
    const update = async (db: Prisma.TransactionClient) => {
      const existing = await db.ticket.findUnique({
        where: { id }, select: { orderId: true, conversationId: true },
      });
      if (!existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

      const order = associationChanged ? await resolveTicketOrder(db, {
        orderId: existing.orderId,
        orderNumber,
        conversationId: conversationId !== undefined ? conversationId || null : existing.conversationId,
      }) : null;
      if (order && "error" in order) return NextResponse.json({ error: order.error }, { status: 400 });

      const ticket = await db.ticket.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(description !== undefined && { description: description.trim() }),
          ...(status !== undefined && { status }),
          ...(priority !== undefined && { priority }),
          ...(resolution !== undefined && { resolution: resolution.trim() }),
          ...(category !== undefined && { category }),
          ...(orderNumber !== undefined && { orderId: order?.orderId ?? null }),
          ...(departmentId !== undefined && { departmentId: departmentId || null }),
          ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
          ...(conversationId !== undefined && { conversationId: conversationId || null }),
        },
        include: ticketDetails,
      });
      return NextResponse.json(ticket);
    };
    return associationChanged
      ? await prisma.$transaction(update, { isolationLevel: "Serializable" })
      : await update(prisma);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "The ticket changed while saving. Reload and try again." }, { status: 409 });
    }
    logger.error("Failed to update ticket:", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "tickets:delete");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    await prisma.ticket.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete ticket:", error);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
