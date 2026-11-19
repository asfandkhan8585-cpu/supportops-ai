import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { isAuthenticated, requireAuth } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "customers:read");
  if (!isAuthenticated(auth)) return auth;

  const { searchParams } = request.nextUrl;
  const { page, limit, skip, take } = parsePagination(searchParams);
  const query = searchParams.get("search")?.trim();
  const where: Prisma.OrderWhereInput = query
    ? {
        OR: [
          { number: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: [{ placedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          number: true,
          status: true,
          currency: true,
          totalMinor: true,
          placedAt: true,
          customer: { select: { id: true, name: true } },
          delivery: { select: { status: true, carrier: true, trackingNumber: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return NextResponse.json(paginatedResponse(orders, total, page, limit));
  } catch (error) {
    logger.error("Failed to load orders", error);
    return NextResponse.json({ error: "Could not load orders." }, { status: 500 });
  }
}
