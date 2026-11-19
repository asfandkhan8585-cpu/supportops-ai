import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MASKED_SECRET, SECRET_FIELDS, maskSettingsSecrets } from "@/lib/security";
import { updateSettingsSchema, validateBody } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "settings:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    let settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: "default" },
      });
    }

    return NextResponse.json(maskSettingsSecrets(settings));
  } catch (error) {
    logger.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, "settings:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Provide a settings object." }, { status: 400 });
    }
    const changes = { ...body } as Record<string, unknown>;

    // Remove fields that should not be updated directly
    delete changes.id;
    delete changes.createdAt;
    delete changes.updatedAt;
    for (const field of SECRET_FIELDS) {
      if (changes[field] === MASKED_SECRET) delete changes[field];
    }

    const validation = validateBody(updateSettingsSchema, changes);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: validation.data,
      create: { id: "default", ...validation.data },
    });

    return NextResponse.json(maskSettingsSecrets(settings));
  } catch (error) {
    logger.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
