import { NextRequest, NextResponse } from "next/server";
import {
  startEmailListener,
  stopEmailListener,
  getEmailStatus,
  testEmailConnection,
} from "@/lib/channels/email";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { publicEmailChannel, saveEmailSettings } from "../channel-settings";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;
  return NextResponse.json(await publicEmailChannel());
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;
  return saveEmailSettings(await request.json().catch(() => null));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;
  const { action } = await request.json().catch(() => null) ?? {};

  if (action === "test") {
    const results = await testEmailConnection();
    if (!results) return NextResponse.json({ error: "Save IMAP and SMTP settings and passwords before testing." }, { status: 400 });
    return NextResponse.json(results);
  }

  if (action === "connect") {
    const result = await startEmailListener();
    if (result === "unconfigured") return NextResponse.json({ error: "Save IMAP and SMTP settings and passwords before connecting." }, { status: 400 });
    if (result === "failed") return NextResponse.json({ error: "Could not open the IMAP inbox. Check the saved settings and test the connection." }, { status: 502 });
    return NextResponse.json({ ...getEmailStatus(), message: "Email listener started." });
  }

  if (action === "disconnect") {
    await stopEmailListener();
    return NextResponse.json({ ...getEmailStatus(), message: "Email listener stopped." });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
