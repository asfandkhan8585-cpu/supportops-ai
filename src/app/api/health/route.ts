import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatProvider } from "@/lib/ai/provider-config";

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, string> = {};

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "connected";
  } catch {
    checks.database = "error";
  }

  let aiService: "openai" | "openrouter" = "openai";
  try {
    const settings = await prisma.settings.findFirst({
      select: { aiApiKey: true, aiProvider: true },
    });
    const { apiKey, baseURL, provider } = getChatProvider(settings);
    aiService = provider;
    if (apiKey) {
      const res = await fetch(baseURL ? `${baseURL}/key` : "https://api.openai.com/v1/models", {
        method: baseURL ? "GET" : "HEAD",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
      checks[aiService] = res.ok ? "reachable" : "error";
    } else {
      checks[aiService] = "not_configured";
    }
  } catch {
    checks[aiService] = "unreachable";
  }

  // Uptime
  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  // Memory
  const mem = process.memoryUsage();

  const allHealthy = Object.values(checks).every(
    (v) => v === "connected" || v === "reachable" || v === "not_configured"
  );

  return NextResponse.json({
    status: allHealthy ? "ok" : "degraded",
    version: process.env.npm_package_version || "0.1.1",
    environment: process.env.NODE_ENV || "development",
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    services: checks,
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
  });
}
