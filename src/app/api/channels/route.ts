import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import {
  publicChannel, publicEmailChannel, publicWhatsAppChannel,
  saveEmailSettings, saveWhatsAppSettings,
} from "./channel-settings";

const CHANNEL_TYPES = ["whatsapp", "email", "sms", "telegram"];

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const channels = await prisma.channel.findMany({
      orderBy: { type: "asc" },
    });

    const channelMap = new Map(channels.map((ch) => [ch.type, ch]));
    const result = await Promise.all(CHANNEL_TYPES.map((type) => {
      const channel = channelMap.get(type);
      if (type === "email") return publicEmailChannel(channel);
      if (type === "whatsapp") return publicWhatsAppChannel(channel);
      return publicChannel(type, channel);
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Failed to fetch channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const { type, isActive, config } = body;

    if (!type || !CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type. Must be one of: " + CHANNEL_TYPES.join(", ") },
        { status: 400 }
      );
    }

    if (type === "email") return await saveEmailSettings(body);
    if (type === "whatsapp") return await saveWhatsAppSettings(body);

    const channel = await prisma.channel.upsert({
      where: { type },
      update: {
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        config: config ?? undefined,
      },
      create: {
        type,
        isActive: typeof isActive === "boolean" ? isActive : false,
        config: config ?? {},
        status: "disconnected",
      },
    });

    return NextResponse.json(publicChannel(type, channel), { status: 200 });
  } catch (error) {
    logger.error("Failed to save channel:", error);
    return NextResponse.json(
      { error: "Failed to save channel" },
      { status: 500 }
    );
  }
}
