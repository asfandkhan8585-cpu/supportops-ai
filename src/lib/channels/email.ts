import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { escapeHtml, MASKED_SECRET, sanitizeEmailSubject } from "@/lib/security";
import { logger } from "@/lib/logger";
import { resolveCustomer } from "@/lib/customer-resolver";

interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

let imapConnection: Imap | null = null;
let isListening = false;

const emailSettingsSelect = {
  imapHost: true, imapPort: true, imapUser: true, imapPass: true,
  smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
} as const;

export function readLegacyEmailSettings(config: unknown): Partial<EmailConfig> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const values = config as Record<string, unknown>;
  const textFields = ["imapHost", "imapUser", "imapPass", "smtpHost", "smtpUser", "smtpPass", "smtpFrom"] as const;
  const settings: Partial<EmailConfig> = {};
  for (const key of textFields) {
    const value = values[key];
    if (typeof value === "string" && value !== MASKED_SECRET) settings[key] = value;
  }
  for (const key of ["imapPort", "smtpPort"] as const) {
    const raw = values[key];
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535) settings[key] = value;
  }
  return settings;
}

export async function getEmailSettings(legacyConfig?: unknown): Promise<EmailConfig | null> {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: emailSettingsSelect,
  });
  if (settings?.imapHost || settings?.smtpHost) return settings;

  const storedConfig = legacyConfig === undefined
    ? (await prisma.channel.findUnique({ where: { type: "email" }, select: { config: true } }))?.config
    : legacyConfig;
  const legacy = readLegacyEmailSettings(storedConfig);
  if (!legacy.imapHost && !legacy.smtpHost) return settings;
  return {
    imapHost: "", imapPort: 993, imapUser: "", imapPass: "",
    smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "", smtpFrom: "",
    ...settings, ...legacy,
  };
}

function isConfigured(config: EmailConfig | null): config is EmailConfig {
  return !!config && [
    config.imapHost, config.imapUser, config.imapPass,
    config.smtpHost, config.smtpUser, config.smtpPass,
  ].every((value) => !!value.trim() && value !== MASKED_SECRET);
}

function createImapConnection(config: EmailConfig): Imap {
  return new Imap({
    user: config.imapUser,
    password: config.imapPass,
    host: config.imapHost,
    port: config.imapPort,
    tls: true,
    connTimeout: 8000,
    authTimeout: 8000,
  });
}

function getSmtpTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    requireTLS: config.smtpPort !== 465,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

async function processEmail(parsed: ParsedMail, config: EmailConfig) {
  const fromAddress = parsed.from?.value?.[0]?.address;
  const fromName =
    parsed.from?.value?.[0]?.name || fromAddress || "Unknown";
  const subject = parsed.subject || "No Subject";
  const textBody = parsed.text || "";

  if (!fromAddress) return;

  // Resolve customer identity across channels
  const customerId = await resolveCustomer("email", fromAddress, fromName);

  // Find or create conversation
  let conversation = await prisma.conversation.findFirst({
    where: {
      channel: "email",
      status: { in: ["active", "escalated"] },
      OR: [
        { customerId },
        { customerContact: fromAddress },
      ],
    },
  });

  if (!conversation) {
    conversation = await createNewConversation(
      "email",
      fromName,
      fromAddress,
      customerId
    );
  }

  // Get AI response
  const messageContent = `Subject: ${subject}\n\n${textBody}`;
  const aiResponse = await chat(conversation.id, messageContent);
  if (!aiResponse) return;

  // Send reply with branding
  const branding = await getEmailBranding();
  const transporter = getSmtpTransporter(config);
  await transporter.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to: fromAddress,
    subject: sanitizeEmailSubject(`Re: ${subject}`),
    text: aiResponse,
    html: buildEmailHtml(aiResponse, branding),
    inReplyTo: parsed.messageId,
    references: parsed.messageId,
  });
}

interface EmailBranding {
  businessName: string;
  primaryColor?: string;
}

async function getEmailBranding(): Promise<EmailBranding> {
  const settings = await prisma.settings.findFirst({
    select: { businessName: true },
  });
  return {
    businessName: settings?.businessName || "Support",
  };
}

function buildEmailHtml(text: string, branding?: EmailBranding): string {
  const name = branding?.businessName || "Support";
  const color = branding?.primaryColor || "#0F172A";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background-color:${escapeHtml(color)};padding:20px 24px;">
          <h1 style="margin:0;font-size:18px;font-weight:600;color:#FFFFFF;">${escapeHtml(name)}</h1>
        </td></tr>
        <tr><td style="padding:24px;">
          ${text
            .split("\n")
            .map((line) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(line)}</p>`)
            .join("")}
        </td></tr>
        <tr><td style="border-top:1px solid #E2E8F0;padding:16px 24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94A3B8;">${escapeHtml(name)} &middot; Powered by SupportOps AI</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function openInbox(imap: Imap, readOnly: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error | null) => {
      clearTimeout(timeout);
      imap.off("error", finish);
      imap.off("end", onEnd);
      imap.off("close", onEnd);
      if (error) reject(error);
      else resolve();
    };
    const onEnd = () => finish(new Error("IMAP connection ended before opening INBOX."));
    const timeout = setTimeout(() => finish(new Error("IMAP connection timed out.")), 12000);
    imap.once("error", finish);
    imap.once("end", onEnd);
    imap.once("close", onEnd);
    imap.once("ready", () => imap.openBox("INBOX", readOnly, finish));
    try {
      imap.connect();
    } catch (error) {
      finish(error instanceof Error ? error : new Error("IMAP connection failed."));
    }
  });
}

export async function testEmailConnection() {
  const config = await getEmailSettings();
  if (!isConfigured(config)) return null;

  const imap = createImapConnection(config);
  imap.on("error", () => { /* openInbox handles connection errors. */ });
  const smtp = getSmtpTransporter(config);
  const [incoming, outgoing] = await Promise.allSettled([
    openInbox(imap, true).finally(() => imap.destroy()),
    smtp.verify().finally(() => smtp.close()),
  ]);
  return { imap: incoming.status === "fulfilled", smtp: outgoing.status === "fulfilled" };
}

export async function startEmailListener() {
  if (imapConnection) return "started";
  const config = await getEmailSettings();
  if (!isConfigured(config)) return "unconfigured";
  if (imapConnection) return "started";

  const imap = createImapConnection(config);
  const reset = () => {
    if (imapConnection !== imap) return;
    imapConnection = null;
    isListening = false;
  };
  imap.on("error", () => {
    logger.warn("[Email] IMAP connection failed");
    reset();
    imap.destroy();
  });
  imap.once("close", reset);
  imap.once("end", reset);
  imapConnection = imap;
  try {
    await openInbox(imap, false);
  } catch {
    reset();
    imap.destroy();
    return "failed";
  }
  if (imapConnection !== imap) return "failed";

  isListening = true;
  imap.on("mail", () => {
    imap.search(["UNSEEN"], (err, results) => {
      if (err || !results?.length) return;
      const messages = imap.fetch(results, { bodies: "" });
      messages.on("error", () => logger.warn("[Email] Failed to read incoming messages"));
      messages.on("message", (msg) => {
        msg.on("body", (stream) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          simpleParser(stream as any, (error: Error | null, parsed: ParsedMail) => {
            if (error) {
              logger.error("[Email] Parse error:", error);
              return;
            }
            processEmail(parsed, config).catch((failure) =>
              logger.error("[Email] Failed to process email:", failure),
            );
          });
        });
      });
    });
  });
  return "started";
}

export async function stopEmailListener() {
  const connection = imapConnection;
  imapConnection = null;
  isListening = false;
  connection?.destroy();
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const config = await getEmailSettings();
  if (!isConfigured(config)) return false;

  const branding = await getEmailBranding();
  const transporter = getSmtpTransporter(config);
  await transporter.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to,
    subject,
    text: body,
    html: buildEmailHtml(body, branding),
  });

  return true;
}

export function getEmailStatus() {
  return {
    connected: isListening,
    status: isListening ? "connected" : imapConnection ? "connecting" : "disconnected",
  };
}
