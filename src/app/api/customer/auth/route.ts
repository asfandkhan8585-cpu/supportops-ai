import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth";
import { customerSessionCookie, getCurrentCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(1)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

// Spend the same bcrypt work when the address is unknown.
const dummyHash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttxpl0dXiAjCi/YyGi5un41wAtCS";

export async function GET() {
  const customer = await getCurrentCustomer();
  return customer
    ? NextResponse.json({ name: customer.name })
    : NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Send credentials as JSON." }, { status: 415 });
  }

  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address and password." },
      { status: 400 }
    );
  }

  const attempts = checkRateLimit(`customer-login:${parsed.data.email}`, {
    maxRequests: 8,
    windowMs: 60000,
  });
  if (!attempts.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((attempts.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const account = await prisma.customerAccount.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      passwordHash: true,
      customer: { select: { name: true, email: true, isBlocked: true } },
    },
  });
  const valid = await verifyPassword(parsed.data.password, account?.passwordHash ?? dummyHash);
  if (
    !valid ||
    !account ||
    account.customer.isBlocked ||
    account.customer.email.trim().toLowerCase() !== parsed.data.email
  ) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ name: account.customer.name });
  response.cookies.set(customerSessionCookie(account.id));
  return response;
}

export function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(customerSessionCookie());
  return response;
}
