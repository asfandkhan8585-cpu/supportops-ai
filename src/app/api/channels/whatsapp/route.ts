import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppStatus,
  initWhatsApp,
  disconnectWhatsApp,
} from "@/lib/channels/whatsapp";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { asConfig, publicWhatsAppChannel, saveWhatsAppSettings } from "../channel-settings";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;
  const channel = await prisma.channel.findUnique({ where: { type: "whatsapp" } });
  const runtime = getWhatsAppStatus();
  return NextResponse.json({ ...runtime, ...publicWhatsAppChannel(channel), qr: channel?.config && asConfig(channel.config).mode === "api" ? null : runtime.qr });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;
  return saveWhatsAppSettings(await request.json().catch(() => null));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;
  const { action } = await request.json().catch(() => null) ?? {};

  if (action === "connect") {
    const channel = await prisma.channel.findUnique({ where: { type: "whatsapp" } });
    if (asConfig(channel?.config).mode === "api") {
      return NextResponse.json({ error: "WhatsApp Business API messaging is unavailable. Save WhatsApp Web as the connection method." }, { status: 409 });
    }
    await initWhatsApp();
    const status = getWhatsAppStatus();
    if (status.status === "error") return NextResponse.json({ error: status.message }, { status: 502 });
    return NextResponse.json(status);
  }

  if (action === "disconnect") {
    await disconnectWhatsApp();
    return NextResponse.json({ status: "disconnected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
