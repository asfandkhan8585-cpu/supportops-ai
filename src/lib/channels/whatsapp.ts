import { Client, LocalAuth, Message } from "whatsapp-web.js";
import * as qrcode from "qrcode";
import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { logger } from "@/lib/logger";
import { resolveCustomer } from "@/lib/customer-resolver";

let whatsappClient: Client | null = null;
let currentQR: string | null = null;
let connectionStatus: "disconnected" | "qr_ready" | "connecting" | "connected" | "error" = "disconnected";
let statusMessage = "";

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qr: currentQR,
    message: statusMessage,
  };
}

export async function initWhatsApp(): Promise<void> {
  if (whatsappClient) {
    logger.info("[WhatsApp] Client already exists");
    return;
  }

  connectionStatus = "connecting";
  statusMessage = "Initializing WhatsApp client...";

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr: string) => {
    logger.info("[WhatsApp] QR code received");
    const image = await qrcode.toDataURL(qr);
    if (whatsappClient !== client || connectionStatus === "connected") return;
    currentQR = image;
    connectionStatus = "qr_ready";
    statusMessage = "Scan the QR code with WhatsApp on your phone";
  });

  client.on("ready", async () => {
    if (whatsappClient !== client) return;
    logger.info("[WhatsApp] Client is ready");
    currentQR = null;
    connectionStatus = "connected";
    statusMessage = "Connected to WhatsApp";

    await prisma.channel.upsert({
      where: { type: "whatsapp" },
      update: { isActive: true, status: "connected" },
      create: { type: "whatsapp", isActive: true, status: "connected" },
    }).catch(() => logger.warn("[WhatsApp] Could not save channel state"));
  });

  client.on("authenticated", () => {
    if (whatsappClient !== client) return;
    logger.info("[WhatsApp] Authenticated");
    currentQR = null;
    connectionStatus = "connecting";
    statusMessage = "Authenticated, loading chats...";
  });

  client.on("auth_failure", () => {
    if (whatsappClient !== client) return;
    logger.warn("[WhatsApp] Authentication failed");
    whatsappClient = null;
    currentQR = null;
    connectionStatus = "error";
    statusMessage = "WhatsApp authentication failed. Connect and scan a new QR code.";
  });

  client.on("disconnected", async () => {
    if (whatsappClient !== client) return;
    logger.info("[WhatsApp] Disconnected");
    currentQR = null;
    connectionStatus = "disconnected";
    statusMessage = "WhatsApp Web disconnected.";
    whatsappClient = null;

    await prisma.channel.upsert({
      where: { type: "whatsapp" },
      update: { isActive: false, status: "disconnected" },
      create: { type: "whatsapp", isActive: false, status: "disconnected" },
    }).catch(() => logger.warn("[WhatsApp] Could not save channel state"));
  });

  client.on("message", async (message: Message) => {
    try {
      if (whatsappClient !== client || message.fromMe) return;

      const contact = await message.getContact();
      const customerName = contact.pushname || contact.name || "Unknown";
      const customerContact = message.from;

      // Resolve customer identity across channels
      const customerId = await resolveCustomer("whatsapp", customerContact, customerName);

      // Find or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          channel: "whatsapp",
          status: { in: ["active", "escalated"] },
          OR: [
            { customerId },
            { customerContact },
          ],
        },
      });

      if (!conversation) {
        conversation = await createNewConversation(
          "whatsapp",
          customerName,
          customerContact,
          customerId
        );
      }

      let messageContent = message.body;

      // Handle media messages
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        if (media) {
          const mediaType = media.mimetype.split("/")[0];
          messageContent = `[${mediaType} attachment: ${media.filename || "media"}] ${message.body || ""}`;

          if (mediaType === "audio") {
            messageContent = `[Voice message received] ${message.body || ""}`;
          }
        }
      }

      // Get AI response
      const aiResponse = await chat(conversation.id, messageContent);

      // Send response back via WhatsApp
      if (aiResponse && whatsappClient === client) await message.reply(aiResponse);
    } catch (error) {
      logger.error("[WhatsApp] Failed to process message:", error);
    }
  });

  whatsappClient = client;
  try {
    await client.initialize();
  } catch {
    if (whatsappClient !== client) return;
    whatsappClient = null;
    currentQR = null;
    connectionStatus = "error";
    statusMessage = "Could not start WhatsApp Web. Check the browser runtime and try again.";
    await client.destroy().catch(() => { /* The browser may have failed to launch. */ });
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  const client = whatsappClient;
  whatsappClient = null;
  currentQR = null;
  connectionStatus = "disconnected";
  statusMessage = "WhatsApp Web disconnected.";
  if (client) await client.destroy().catch(() => logger.warn("[WhatsApp] Could not close browser"));
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<boolean> {
  if (!whatsappClient || connectionStatus !== "connected") {
    return false;
  }

  const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
  await whatsappClient.sendMessage(chatId, message);
  return true;
}
