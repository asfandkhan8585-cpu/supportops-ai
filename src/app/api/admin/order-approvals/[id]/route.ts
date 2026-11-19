import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { decideOrderApproval } from "@/lib/order-approvals";

const approvalDecision = z.strictObject({ decision: z.enum(["approve", "reject"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Send the decision as JSON." }, { status: 415 });
  }

  const input = approvalDecision.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Approval request not found." }, { status: 404 });

  try {
    const result = await decideOrderApproval(id, input.data.decision, user);
    if (result.code === "NOT_FOUND")
      return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
    if (result.code === "ALREADY_DECIDED")
      return NextResponse.json({ error: "This request already has a decision." }, { status: 409 });
    if (result.code === "ORDER_INELIGIBLE") {
      return NextResponse.json(
        {
          error:
            "The current order status does not allow this action. Review the order or reject the request.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ approval: result.approval, orderStatus: result.orderStatus });
  } catch (error) {
    logger.error("Failed to decide order approval", error);
    return NextResponse.json(
      { error: "Could not save the decision. Please try again." },
      { status: 500 }
    );
  }
}
