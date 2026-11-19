import { cookies } from "next/headers";
import { generateToken, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cookieName = "supportops-customer";

export async function getCurrentCustomer() {
  const token = (await cookies()).get(cookieName)?.value;
  const session = token && verifyToken(token);
  if (!session || session.role !== "customer") return null;

  const account = await prisma.customerAccount.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      customer: { select: { id: true, name: true, email: true, isBlocked: true } },
    },
  });
  if (!account || account.customer.isBlocked || account.customer.email.trim().toLowerCase() !== account.email) return null;
  return { id: account.customer.id, name: account.customer.name };
}

export function customerSessionCookie(accountId?: string) {
  return {
    name: cookieName,
    value: accountId ? generateToken(accountId, "customer") : "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: accountId ? 7 * 24 * 60 * 60 : 0,
    path: "/",
  };
}
