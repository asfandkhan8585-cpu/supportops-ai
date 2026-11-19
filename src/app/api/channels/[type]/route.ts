import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import {
  publicChannel, publicEmailChannel, publicWhatsAppChannel,
  saveEmailSettings, saveWhatsAppSettings,
} from "../channel-settings";

const CHANNEL_TYPES = ["whatsapp", "email", "sms", "telegram"];

type RouteContext = { params: Promise<{ type: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { type } = await context.params;

    if (!CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const channel = await prisma.channel.findUnique({
      where: { type },
    });

    if (type === "email") return NextResponse.json(await publicEmailChannel(channel));
    if (type === "whatsapp") return NextResponse.json(publicWhatsAppChannel(channel));
    return NextResponse.json(publicChannel(type, channel));
  } catch (error) {
    logger.error("Failed to fetch channel:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { type } = await context.params;

    if (!CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (type === "email") return await saveEmailSettings(body);
    if (type === "whatsapp") return await saveWhatsAppSettings(body);
    const { isActive, config, status } = body;

    const channel = await prisma.channel.upsert({
      where: { type },
      update: {
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        config: config ?? undefined,
        status: status ?? undefined,
      },
      create: {
        type,
        isActive: typeof isActive === "boolean" ? isActive : false,
        config: config ?? {},
        status: status ?? "disconnected",
      },
    });

    return NextResponse.json(publicChannel(type, channel));
  } catch (error) {
    logger.error("Failed to update channel:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { type } = await context.params;

    if (!CHANNEL_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid channel type" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !["connect", "disconnect", "test"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be one of: connect, disconnect, test" },
        { status: 400 }
      );
    }

    const channel = await prisma.channel.findUnique({ where: { type } });

    if (action === "disconnect") {
      const updated = await prisma.channel.upsert({
        where: { type },
        update: { status: "disconnected" },
        create: {
          type,
          isActive: false,
          config: {},
          status: "disconnected",
        },
      });
      return NextResponse.json({
        ...publicChannel(type, updated),
        message: `${type} channel disconnected`,
      });
    }

    if (action === "connect") {
      if (!channel?.config || Object.keys(channel.config as object).length === 0) {
        return NextResponse.json(
          { error: "Channel must be configured before connecting" },
          { status: 400 }
        );
      }

      const updated = await prisma.channel.update({
        where: { type },
        data: { status: "connected", isActive: true },
      });

      return NextResponse.json({
        ...publicChannel(type, updated),
        message: `${type} channel connected`,
      });
    }

    if (action === "test") {
      if (!channel?.config || Object.keys(channel.config as object).length === 0) {
        return NextResponse.json(
          { error: "Channel must be configured before testing" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${type} connection test initiated`,
        channel: publicChannel(type, channel),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error("Failed to perform channel action:", error);
    return NextResponse.json(
      { error: "Failed to perform channel action" },
      { status: 500 }
    );
  }
}
