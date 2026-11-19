import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import type { Prisma } from "@/generated/prisma/client";
import { associationError, resolveTicketOrder, ticketAssociationInput, ticketOrder } from "./ticket-order";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "tickets:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, limit, skip, take } = parsePagination(searchParams);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const departmentId = searchParams.get("departmentId");
    const search = searchParams.get("search");

    const where: Prisma.TicketWhereInput = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (priority && priority !== "all") {
      where.priority = priority;
    }
    if (category && category !== "all") where.category = category;

    if (departmentId && departmentId !== "all") {
      where.departmentId = departmentId;
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
        { order: { number: { contains: search.trim(), mode: "insensitive" } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        include: {
          order: ticketOrder,
          conversation: {
            select: {
              id: true,
              customerName: true,
              channel: true,
              status: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json(paginatedResponse(tickets, total, page, limit));
  } catch (error) {
    logger.error("Failed to fetch tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "tickets:create");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const association = ticketAssociationInput.safeParse(body);
    if (!association.success) return NextResponse.json({ error: associationError }, { status: 400 });
    const { category, orderNumber, conversationId } = association.data;
    const {
      title,
      description,
      priority,
      status,
      departmentId,
      assignedToId,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Ticket title is required" },
        { status: 400 }
      );
    }

    const create = async (db: Prisma.TransactionClient) => {
      const order = orderNumber ? await resolveTicketOrder(db, { orderNumber, conversationId }) : null;
      if (order && "error" in order) return NextResponse.json({ error: order.error }, { status: 400 });
      const ticket = await db.ticket.create({
        data: {
          title: title.trim(),
          description: description?.trim() || "",
          priority: priority || "medium",
          status: status || "open",
          ...(category && { category }),
          ...(order?.orderId && { orderId: order.orderId }),
          ...(conversationId && { conversationId }),
          ...(departmentId && { departmentId }),
          ...(assignedToId && { assignedToId }),
        },
        include: {
          order: ticketOrder,
          conversation: { select: { id: true, customerName: true, channel: true, status: true } },
          department: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });
      return NextResponse.json(ticket, { status: 201 });
    };
    return orderNumber
      ? await prisma.$transaction(create, { isolationLevel: "Serializable" })
      : await create(prisma);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "The linked records changed while saving. Try again." }, { status: 409 });
    }
    logger.error("Failed to create ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
