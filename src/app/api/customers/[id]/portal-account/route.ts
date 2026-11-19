import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const password = z.object({
  password: z.string().min(12).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "Send the password as JSON." }, { status: 415 });
  }

  const input = password.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "Use a password with at least 12 characters and at most 72 bytes." }, { status: 400 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { email: true, isBlocked: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const email = z.string().trim().toLowerCase().email().max(254).safeParse(customer.email);
  if (!email.success || customer.isBlocked) {
    return NextResponse.json({ error: "Activate the customer and set their email before granting access." }, { status: 400 });
  }

  const passwordHash = await hashPassword(input.data.password);
  try {
    await prisma.customerAccount.upsert({
      where: { customerId: id },
      create: { customerId: id, email: email.data, passwordHash },
      update: { id: randomUUID(), email: email.data, passwordHash },
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This email is already used by another portal account." }, { status: 409 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204 });
}
