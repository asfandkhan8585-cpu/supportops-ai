import { NextResponse } from "next/server";
import { z } from "zod";
import { getEmailSettings, getEmailStatus, readLegacyEmailSettings, stopEmailListener } from "@/lib/channels/email";
import { disconnectWhatsApp, getWhatsAppStatus } from "@/lib/channels/whatsapp";
import { prisma } from "@/lib/prisma";
import { MASKED_SECRET, maskSecret, maskSettingsSecrets } from "@/lib/security";
import { updateSettingsSchema } from "@/lib/validations";
import type { Channel } from "@/generated/prisma/client";

const port = z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(65535),
).optional();

const emailConfig = updateSettingsSchema.pick({
  smtpHost: true, smtpUser: true, smtpPass: true, smtpFrom: true,
  imapHost: true, imapUser: true, imapPass: true,
}).extend({ smtpPort: port, imapPort: port });

const whatsappConfig = z.strictObject({
  mode: z.enum(["web", "api"]).optional(),
  apiKey: z.string().max(500).optional(),
  phoneNumber: z.string().max(50).optional(),
});

const emailInput = z.object({ config: emailConfig.optional(), isActive: z.boolean().optional() });
const whatsappInput = z.object({ config: whatsappConfig.optional(), isActive: z.boolean().optional() });

export function asConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function publicChannel(type: string, channel?: Channel | null) {
  const { config, ...details } = channel ?? {
    id: null, type, isActive: false, config: {}, status: "disconnected", createdAt: null, updatedAt: null,
  };
  return {
    ...details,
    config: Object.fromEntries(Object.entries(asConfig(config)).map(([key, value]) => [
      key,
      /password|pass$|token|secret|api.?key|auth.?key/i.test(key)
        ? maskSecret(typeof value === "string" ? value : value ? "set" : "")
        : value,
    ])),
  };
}

export async function publicEmailChannel(channel?: Channel | null) {
  const settings = await getEmailSettings(channel?.config);
  const runtime = getEmailStatus();
  return {
    ...publicChannel("email", channel),
    ...runtime,
    isActive: runtime.status !== "disconnected",
    config: settings ? maskSettingsSecrets({ ...settings }) : {},
  };
}

export function publicWhatsAppChannel(channel?: Channel | null) {
  const runtime = getWhatsAppStatus();
  const details = publicChannel("whatsapp", channel);
  const status = details.config.mode === "api" ? "disconnected" : runtime.status;
  return { ...details, status, isActive: status === "connected" };
}

export async function saveEmailSettings(body: unknown) {
  const result = emailInput.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Enter valid email settings and port numbers." }, { status: 400 });
  const config = result.data.config ?? {};
  if (config.smtpPass === MASKED_SECRET) delete config.smtpPass;
  if (config.imapPass === MASKED_SECRET) delete config.imapPass;

  const channel = await prisma.$transaction(async (tx) => {
    const previous = await tx.channel.findUnique({ where: { type: "email" }, select: { config: true } });
    const legacy = readLegacyEmailSettings(previous?.config);
    let changes = config;
    if (legacy.imapHost || legacy.smtpHost) {
      const settings = await tx.settings.findUnique({ where: { id: "default" }, select: { imapHost: true, smtpHost: true } });
      if (!settings?.imapHost && !settings?.smtpHost) changes = { ...legacy, ...config };
    }
    if (Object.keys(changes).length) {
      await tx.settings.upsert({ where: { id: "default" }, update: changes, create: { id: "default", ...changes } });
    }
    return tx.channel.upsert({
      where: { type: "email" },
      update: { isActive: false, status: "disconnected", config: {} },
      create: { type: "email" },
    });
  });
  await stopEmailListener();
  return NextResponse.json(await publicEmailChannel(channel));
}

export async function saveWhatsAppSettings(body: unknown) {
  const result = whatsappInput.safeParse(body);
  if (!result.success) return NextResponse.json({ error: "Enter valid WhatsApp settings." }, { status: 400 });
  const previous = await prisma.channel.findUnique({ where: { type: "whatsapp" } });
  const previousConfig = whatsappConfig.strip().safeParse(asConfig(previous?.config));
  const changes = result.data.config ?? {};
  if (changes.apiKey === MASKED_SECRET) delete changes.apiKey;
  const config = { ...previousConfig.data, ...changes };
  if (config.mode === "api" || result.data.isActive === false) await disconnectWhatsApp();
  const status = getWhatsAppStatus().status;
  const update = { config, status, isActive: status === "connected" };
  const channel = await prisma.channel.upsert({
    where: { type: "whatsapp" },
    update,
    create: { type: "whatsapp", ...update },
  });
  return NextResponse.json(publicWhatsAppChannel(channel));
}
