import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const approvalFilter = z.enum(["pending", "approved", "rejected", "all"]);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const filter = approvalFilter.safeParse(searchParams.get("status") ?? "pending");
  if (!filter.success)
    return NextResponse.json({ error: "Choose a valid approval status." }, { status: 400 });
  const { page, limit, skip, take } = parsePagination(searchParams);
  const where = filter.data === "all" ? {} : { status: filter.data };

  try {
    const [approvals, total] = await Promise.all([
      prisma.orderApprovalRequest.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          type: true,
          status: true,
          reason: true,
          createdAt: true,
          conversationId: true,
          order: {
            select: { number: true, status: true, customer: { select: { name: true } } },
          },
        },
      }),
      prisma.orderApprovalRequest.count({ where }),
    ]);
    const decidedIds = approvals.filter(({ status }) => status !== "pending").map(({ id }) => id);
    const decisions = decidedIds.length
      ? await prisma.activityLog.findMany({
          where: {
            entity: "order_approval",
            entityId: { in: decidedIds },
            action: { in: ["approval.approved", "approval.rejected"] },
          },
          select: { entityId: true, userName: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
    const decisionById = new Map(
      decisions.map(({ entityId, ...decision }) => [entityId, decision])
    );
    const result = approvals.map((approval) => ({
      ...approval,
      decision: decisionById.get(approval.id) ?? null,
    }));
    return NextResponse.json(paginatedResponse(result, total, page, limit));
  } catch (error) {
    logger.error("Failed to load order approvals", error);
    return NextResponse.json({ error: "Could not load order approvals." }, { status: 500 });
  }
}
