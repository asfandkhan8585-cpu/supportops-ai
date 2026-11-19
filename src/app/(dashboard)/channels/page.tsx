"use client";

import { Header } from "@/components/layout/header";
import Image from "next/image";
import {
  MessageCircle,
  Mail,
  Wifi,
  WifiOff,
  Save,
  Loader2,
  QrCode,
  Key,
  TestTube,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelData {
  id: string | null;
  type: string;
  isActive: boolean;
  config: Record<string, unknown>;
  status: string;
}

type WhatsAppMode = "web" | "api";
type SaveChannel = (type: string, config: Record<string, unknown>) => Promise<ChannelData | null>;
type ChannelAction = (type: string, action: string) => Promise<{ imap?: boolean; smtp?: boolean } | null>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const isConnected = status === "connected";
  const label = { connected: "Connected", connecting: "Connecting", qr_ready: "Waiting for QR scan", error: "Connection failed" }[status] ?? "Disconnected";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        isConnected
          ? "bg-supportops-success/10 text-supportops-success"
          : "bg-supportops-danger/10 text-supportops-danger"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isConnected ? "bg-supportops-success" : "bg-supportops-danger"
        )}
      />
      {label}
    </span>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  isSecret = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  isSecret?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-xs font-medium text-supportops-text-light mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={isSecret && !visible ? "password" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/50 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary transition-colors"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-supportops-text-light hover:text-supportops-text transition-colors"
          >
            {visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp Card
// ---------------------------------------------------------------------------

function WhatsAppCard({
  channel,
  onSave,
  onAction,
  onRefresh,
  saving,
}: {
  channel: ChannelData;
  onSave: SaveChannel;
  onAction: ChannelAction;
  onRefresh: () => Promise<void>;
  saving: boolean;
}) {
  const cfg = channel.config as Record<string, string>;
  const [mode, setMode] = useState<WhatsAppMode>(
    (cfg.mode as WhatsAppMode) || "web"
  );
  const [apiKey, setApiKey] = useState(cfg.apiKey || "");
  const [phoneNumber, setPhoneNumber] = useState(cfg.phoneNumber || "");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnected = channel.status === "connected";

  // Poll WhatsApp status while connecting to get QR code updates
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setQrCode(null);
    setConnectError("");
    try {
      const res = await fetch("/api/channels/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not connect to WhatsApp Web.");
      if (data.status === "connected") {
        setConnecting(false);
        await onRefresh();
        return;
      }
      if (data.qr) setQrCode(data.qr);
      // Start polling for QR code / status updates
      if (pollRef.current) clearInterval(pollRef.current);
      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          if (Date.now() - startedAt > 120000) throw new Error("WhatsApp connection timed out. Try connecting again.");
          const statusRes = await fetch("/api/channels/whatsapp");
          if (!statusRes.ok) throw new Error("Could not read WhatsApp connection status.");
          const status = await statusRes.json();
          setQrCode(status.qr || null);
          if (status.status === "error" || status.status === "disconnected") {
            throw new Error(status.message || "WhatsApp Web disconnected.");
          }
          if (status.status === "connected") {
            if (pollRef.current) clearInterval(pollRef.current);
            setConnecting(false);
            await onRefresh();
          }
        } catch (error) {
          if (pollRef.current) clearInterval(pollRef.current);
          setQrCode(null);
          setConnecting(false);
          setConnectError(error instanceof Error ? error.message : "Could not connect to WhatsApp Web.");
        }
      }, 3000);
    } catch (error) {
      setConnecting(false);
      setConnectError(error instanceof Error ? error.message : "Could not connect to WhatsApp Web.");
    }
  };

  return (
    <div className="bg-supportops-surface rounded-xl border border-supportops-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-supportops-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-supportops-text">WhatsApp</h3>
              <p className="text-xs text-supportops-text-light mt-0.5">
                Messaging via WhatsApp Web
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={channel.status} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Mode selector */}
        <div>
          <label className="block text-xs font-medium text-supportops-text-light mb-2">
            Connection Method
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={connecting || saving}
              onClick={() => setMode("web")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                mode === "web"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-supportops-border bg-supportops-bg text-supportops-text-light hover:bg-supportops-primary-50 hover:text-supportops-text"
              )}
            >
              <QrCode className="h-4 w-4" />
              WhatsApp Web
            </button>
            <button
              type="button"
              disabled={connecting || saving}
              onClick={() => setMode("api")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                mode === "api"
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-supportops-border bg-supportops-bg text-supportops-text-light hover:bg-supportops-primary-50 hover:text-supportops-text"
              )}
            >
              <Key className="h-4 w-4" />
              API
            </button>
          </div>
        </div>

        {mode === "web" ? (
          <div>
            {isConnected ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Session Active
                  </span>
                </div>
                {phoneNumber && (
                  <p className="text-sm text-green-600">
                    Phone: {phoneNumber}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onAction("whatsapp", "disconnect")}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <WifiOff className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-supportops-border bg-supportops-bg p-6 flex flex-col items-center">
                <div className="w-48 h-48 bg-white border-2 border-dashed border-supportops-border rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                  {qrCode ? (
                    <Image
                      src={qrCode}
                      width={192}
                      height={192}
                      unoptimized
                      alt="WhatsApp QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : connecting ? (
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  ) : (
                    <div className="text-center">
                      <QrCode className="h-10 w-10 text-supportops-text-light/40 mx-auto mb-1" />
                      <p className="text-xs text-supportops-text-light/60">
                        QR Code
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-supportops-text-light text-center max-w-[220px]">
                  {qrCode
                    ? "Scan this QR code with WhatsApp on your phone to connect"
                    : "Click Connect to generate a QR code"}
                </p>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || saving || cfg.mode === "api"}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  {connecting ? "Connecting..." : "Connect"}
                </button>
                {cfg.mode === "api" && <p className="mt-2 text-sm">Save WhatsApp Web before connecting.</p>}
                {connectError && <p className="mt-2 text-sm text-supportops-danger" role="alert">{connectError}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <FieldInput
              label="API Key"
              value={apiKey}
              onChange={setApiKey}
              placeholder="Enter your WhatsApp API key"
              isSecret
            />
            <FieldInput
              label="Phone Number"
              value={phoneNumber}
              onChange={setPhoneNumber}
              placeholder="+1234567890"
            />
            <p className="text-sm text-supportops-text-light">This app can store Business API settings. Messaging requires WhatsApp Web.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-supportops-border bg-supportops-bg/50">
        <button
          type="button"
          disabled={saving || connecting}
          onClick={async () => {
            const saved = await onSave("whatsapp", { mode, apiKey, phoneNumber });
            if (saved) setApiKey(String(saved.config.apiKey ?? ""));
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-supportops-primary rounded-lg hover:bg-supportops-primary-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email Card
// ---------------------------------------------------------------------------

function EmailCard({
  channel,
  onSave,
  onAction,
  saving,
}: {
  channel: ChannelData;
  onSave: SaveChannel;
  onAction: ChannelAction;
  saving: boolean;
}) {
  const cfg = channel.config as Record<string, string>;
  const [smtpHost, setSmtpHost] = useState(cfg.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(String(cfg.smtpPort || "587"));
  const [smtpUser, setSmtpUser] = useState(cfg.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState(cfg.smtpPass || "");
  const [smtpFrom, setSmtpFrom] = useState(cfg.smtpFrom || "");

  const [imapHost, setImapHost] = useState(cfg.imapHost || "");
  const [imapPort, setImapPort] = useState(String(cfg.imapPort || "993"));
  const [imapUser, setImapUser] = useState(cfg.imapUser || "");
  const [imapPass, setImapPass] = useState(cfg.imapPass || "");

  const [testResult, setTestResult] = useState<{ imap?: boolean; smtp?: boolean } | null>(null);
  const [acting, setActing] = useState(false);
  const connected = channel.status !== "disconnected";

  const handleAction = async (action: string) => {
    setActing(true);
    try {
      if (action === "test") setTestResult(null);
      const result = await onAction("email", action);
      if (action === "test") setTestResult(result);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="bg-supportops-surface rounded-xl border border-supportops-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-supportops-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-supportops-text">Email</h3>
              <p className="text-xs text-supportops-text-light mt-0.5">
                Send and receive via SMTP / IMAP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={channel.status} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* SMTP */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-supportops-text-light mb-3">
            SMTP Settings (Outgoing)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Host"
              value={smtpHost}
              onChange={setSmtpHost}
              placeholder="smtp.example.com"
            />
            <FieldInput
              label="Port"
              value={smtpPort}
              onChange={setSmtpPort}
              placeholder="587"
              type="text"
            />
            <FieldInput
              label="Username"
              value={smtpUser}
              onChange={setSmtpUser}
              placeholder="user@example.com"
            />
            <FieldInput
              label="Password"
              value={smtpPass}
              onChange={setSmtpPass}
              placeholder="Password"
              isSecret
            />
          </div>
          <div className="mt-3">
            <FieldInput
              label="From Address"
              value={smtpFrom}
              onChange={setSmtpFrom}
              placeholder="noreply@example.com"
            />
          </div>
        </div>

        {/* IMAP */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-supportops-text-light mb-3">
            IMAP Settings (Incoming)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Host"
              value={imapHost}
              onChange={setImapHost}
              placeholder="imap.example.com"
            />
            <FieldInput
              label="Port"
              value={imapPort}
              onChange={setImapPort}
              placeholder="993"
              type="text"
            />
            <FieldInput
              label="Username"
              value={imapUser}
              onChange={setImapUser}
              placeholder="user@example.com"
            />
            <FieldInput
              label="Password"
              value={imapPass}
              onChange={setImapPass}
              placeholder="Password"
              isSecret
            />
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <ul className="rounded-lg border border-supportops-border p-3 text-sm" role="status">
            <li>IMAP inbox {testResult.imap ? "verified" : "connection failed"}</li>
            <li>SMTP authentication {testResult.smtp ? "verified" : "connection failed"}</li>
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-supportops-border bg-supportops-bg/50 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || acting}
          onClick={async () => {
            const saved = await onSave("email", {
              smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom,
              imapHost, imapPort, imapUser, imapPass,
            });
            if (saved) {
              setSmtpPass(String(saved.config.smtpPass ?? ""));
              setImapPass(String(saved.config.imapPass ?? ""));
              setTestResult(null);
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-supportops-primary rounded-lg hover:bg-supportops-primary-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={() => handleAction("test")}
          disabled={saving || acting}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <TestTube className="h-4 w-4" />
          Test Connection
        </button>
        <button
          type="button"
          onClick={() => handleAction(connected ? "disconnect" : "connect")}
          disabled={saving || acting}
          className="rounded-lg border border-supportops-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
        <p className="basis-full text-xs text-supportops-text-light">Test Connection checks the saved settings without sending a message. Reconnect after saving changes.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const fetchChannels = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch("/api/channels");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setChannels(data);
    } catch {
      setFetchError("Failed to load channels. Please try refreshing the page.");
      showToast("Failed to load channels", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleSave = async (
    type: string,
    config: Record<string, unknown>
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/channels/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error?.message || updated.error || "Failed to save settings");
      setChannels((prev) =>
        prev.map((ch) => (ch.type === type ? updated : ch))
      );
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} settings saved`);
      return updated as ChannelData;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save settings", "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (type: string, action: string) => {
    try {
      const res = await fetch(`/api/channels/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || err.error || "Action failed");
      }
      const data = await res.json();
      if (action !== "test") {
        await fetchChannels();
        showToast(data.message || "Action completed");
      }
      return data as { imap?: boolean; smtp?: boolean };
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Action failed",
        "error"
      );
      return null;
    }
  };

  const getChannel = (type: string): ChannelData =>
    channels.find((ch) => ch.type === type) || {
      id: null,
      type,
      isActive: false,
      config: {},
      status: "disconnected",
    };

  return (
    <>
      <Header
        title="Channels"
        description="Connect and manage your communication channels"
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-supportops-primary" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-medium text-supportops-text">Could not load channels</p>
            <p className="text-sm text-supportops-text-light mt-1">{fetchError}</p>
            <button
              onClick={() => { setLoading(true); fetchChannels(); }}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-supportops-primary rounded-lg hover:bg-supportops-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl">
            <WhatsAppCard
              channel={getChannel("whatsapp")}
              onSave={handleSave}
              onAction={handleAction}
              onRefresh={fetchChannels}
              saving={saving}
            />
            <EmailCard
              channel={getChannel("email")}
              onSave={handleSave}
              onAction={handleAction}
              saving={saving}
            />
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-4 duration-300",
            toast.type === "success"
              ? "bg-supportops-success text-white"
              : "bg-supportops-danger text-white"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
