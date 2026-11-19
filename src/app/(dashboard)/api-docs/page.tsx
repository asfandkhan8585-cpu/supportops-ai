"use client";

import { Header } from "@/components/layout/header";
import {
  Key,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Ticket,
  BookOpen,
  Users,
  Webhook,
  Download,
  Heart,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  queryParams?: { name: string; type: string; required: boolean; description: string }[];
}

interface ApiSection {
  id: string;
  name: string;
  icon: React.ElementType;
  endpoints: Endpoint[];
}

// ---------------------------------------------------------------------------
// API Sections Data
// ---------------------------------------------------------------------------

const apiSections: ApiSection[] = [
  {
    id: "chat",
    name: "Chat",
    icon: MessageSquare,
    endpoints: [
      {
        method: "POST",
        path: "/api/chat",
        description: "Send a message and get an AI-generated response. The AI uses your knowledge base and conversation history to generate relevant answers.",
        params: [],
      },
    ],
  },
  {
    id: "conversations",
    name: "Conversations",
    icon: MessagesSquare,
    endpoints: [
      {
        method: "GET",
        path: "/api/conversations",
        description: "List all conversations with optional filtering by status or channel.",
        queryParams: [
          { name: "status", type: "string", required: false, description: "Filter by status: active, closed, archived" },
          { name: "channel", type: "string", required: false, description: "Filter by channel: WhatsApp, email, SMS, Telegram, API, widget, or archived calls" },
        ],
      },
      {
        method: "POST",
        path: "/api/conversations",
        description: "Create a new conversation.",
      },
      {
        method: "GET",
        path: "/api/conversations/:id",
        description: "Get a specific conversation with its messages.",
        params: [
          { name: "id", type: "string", required: true, description: "Conversation ID" },
        ],
      },
      {
        method: "PUT",
        path: "/api/conversations/:id",
        description: "Update a conversation's status, customer info, or metadata.",
        params: [
          { name: "id", type: "string", required: true, description: "Conversation ID" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/conversations/:id",
        description: "Delete a conversation and all its messages.",
        params: [
          { name: "id", type: "string", required: true, description: "Conversation ID" },
        ],
      },
      {
        method: "POST",
        path: "/api/conversations/:id/messages",
        description: "Add a message to an existing conversation.",
        params: [
          { name: "id", type: "string", required: true, description: "Conversation ID" },
        ],
      },
    ],
  },
  {
    id: "tickets",
    name: "Tickets",
    icon: Ticket,
    endpoints: [
      {
        method: "GET",
        path: "/api/tickets",
        description: "List all tickets with optional filtering.",
        queryParams: [
          { name: "status", type: "string", required: false, description: "Filter by status: open, in_progress, resolved, closed" },
          { name: "priority", type: "string", required: false, description: "Filter by priority: low, medium, high, urgent" },
        ],
      },
      {
        method: "POST",
        path: "/api/tickets",
        description: "Create a new support ticket.",
      },
      {
        method: "GET",
        path: "/api/tickets/:id",
        description: "Get a specific ticket with related conversation and assignment details.",
        params: [
          { name: "id", type: "string", required: true, description: "Ticket ID" },
        ],
      },
      {
        method: "PUT",
        path: "/api/tickets/:id",
        description: "Update a ticket's status, priority, assignment, or resolution.",
        params: [
          { name: "id", type: "string", required: true, description: "Ticket ID" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/tickets/:id",
        description: "Delete a ticket permanently.",
        params: [
          { name: "id", type: "string", required: true, description: "Ticket ID" },
        ],
      },
    ],
  },
  {
    id: "knowledge",
    name: "Knowledge Base",
    icon: BookOpen,
    endpoints: [
      {
        method: "GET",
        path: "/api/knowledge/categories",
        description: "List all knowledge base categories with entry counts.",
      },
      {
        method: "POST",
        path: "/api/knowledge/categories",
        description: "Create a new knowledge base category.",
      },
      {
        method: "GET",
        path: "/api/knowledge/entries",
        description: "List knowledge base entries, optionally filtered by category.",
        queryParams: [
          { name: "categoryId", type: "string", required: false, description: "Filter by category ID" },
        ],
      },
      {
        method: "POST",
        path: "/api/knowledge/entries",
        description: "Create a new knowledge base entry.",
      },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    icon: Users,
    endpoints: [
      {
        method: "GET",
        path: "/api/settings",
        description: "Get the current application settings.",
      },
      {
        method: "PUT",
        path: "/api/settings",
        description: "Update application settings. Only include the fields you want to change.",
      },
    ],
  },
  {
    id: "webhooks",
    name: "Webhooks",
    icon: Webhook,
    endpoints: [
      {
        method: "GET",
        path: "/api/webhooks",
        description: "List all configured webhooks.",
      },
      {
        method: "POST",
        path: "/api/webhooks",
        description: "Create a new webhook.",
      },
    ],
  },
  {
    id: "export",
    name: "Export",
    icon: Download,
    endpoints: [
      {
        method: "GET",
        path: "/api/export",
        description: "Export data in CSV or JSON format. Supports exporting conversations, tickets, knowledge base entries, and customers.",
        queryParams: [
          { name: "type", type: "string", required: true, description: "Data type: conversations, tickets, knowledge, customers" },
          { name: "format", type: "string", required: true, description: "Output format: csv or json" },
        ],
      },
    ],
  },
  {
    id: "health",
    name: "Health Check",
    icon: Heart,
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        description: "Check the API health status. Returns uptime and database connectivity status.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Method Badge
// ---------------------------------------------------------------------------

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide min-w-[56px] justify-center",
        methodColors[method] || "bg-gray-100 text-gray-800"
      )}
    >
      {method}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Try It Panel
// ---------------------------------------------------------------------------

function TryItPanel({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState("");

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setResponseStatus(null);

    try {
      let url = endpoint.path;

      // Replace path params
      if (endpoint.params) {
        for (const p of endpoint.params) {
          url = url.replace(`:${p.name}`, paramValues[p.name] || `{${p.name}}`);
        }
      }

      // Add query params
      if (endpoint.queryParams) {
        const qp = new URLSearchParams();
        for (const p of endpoint.queryParams) {
          if (paramValues[p.name]) qp.set(p.name, paramValues[p.name]);
        }
        const qs = qp.toString();
        if (qs) url += `?${qs}`;
      }

      const opts: RequestInit = {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
      };

      if ((endpoint.method === "POST" || endpoint.method === "PUT") && bodyText.trim()) {
        opts.body = bodyText;
      }

      const res = await fetch(url, opts);
      setResponseStatus(res.status);

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const json = await res.json();
        setResponse(JSON.stringify(json, null, 2));
      } else {
        const text = await res.text();
        setResponse(text.slice(0, 2000));
      }
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : "Request failed"}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint, paramValues, bodyText]);

  const allParams = [
    ...(endpoint.params || []),
    ...(endpoint.queryParams || []),
  ];

  return (
    <div className="mt-4 border border-supportops-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-supportops-text bg-supportops-primary-50 hover:bg-supportops-primary-100 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-supportops-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-supportops-primary" />
        )}
        <Send className="h-4 w-4 text-supportops-primary" />
        Try it
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-supportops-surface border-t border-supportops-border">
          {allParams.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-supportops-text-light uppercase tracking-wider">
                Parameters
              </h4>
              {allParams.map((p) => (
                <div key={p.name} className="flex items-start gap-3">
                  <div className="w-40 flex-shrink-0">
                    <label className="text-sm font-medium text-supportops-text">
                      {p.name}
                      {p.required && <span className="text-supportops-danger ml-0.5">*</span>}
                    </label>
                    <p className="text-xs text-supportops-text-light">{p.type}</p>
                  </div>
                  <input
                    type="text"
                    placeholder={p.description}
                    className="flex-1 px-3 py-1.5 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary transition-theme"
                    value={paramValues[p.name] || ""}
                    onChange={(e) =>
                      setParamValues({ ...paramValues, [p.name]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {(endpoint.method === "POST" || endpoint.method === "PUT") && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-supportops-text-light uppercase tracking-wider">
                Request Body (JSON)
              </h4>
              <textarea
                className="w-full h-40 px-3 py-2 text-sm font-mono border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary resize-y transition-theme"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-supportops-primary text-white text-sm font-medium rounded-lg hover:bg-supportops-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Request
          </button>

          {response !== null && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-supportops-text-light uppercase tracking-wider">
                  Response
                </span>
                {responseStatus !== null && (
                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded",
                      responseStatus >= 200 && responseStatus < 300
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    )}
                  >
                    {responseStatus}
                  </span>
                )}
              </div>
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 text-sm p-4 rounded-lg border border-gray-700 overflow-x-auto max-h-80">
                <code>{response}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Endpoint Card
// ---------------------------------------------------------------------------

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="border border-supportops-border rounded-xl bg-supportops-surface p-6 transition-theme">
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-semibold text-supportops-text font-mono">
          {endpoint.path}
        </code>
      </div>

      <p className="mt-3 text-sm text-supportops-text-light leading-relaxed">
        {endpoint.description}
      </p>

      {/* Parameters table */}
      {((endpoint.params && endpoint.params.length > 0) ||
        (endpoint.queryParams && endpoint.queryParams.length > 0)) && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-supportops-text-light uppercase tracking-wider mb-2">
            Parameters
          </h4>
          <div className="border border-supportops-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-supportops-bg">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-supportops-text-light uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-supportops-text-light uppercase">
                    Type
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-supportops-text-light uppercase">
                    Required
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-supportops-text-light uppercase">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...(endpoint.params || []), ...(endpoint.queryParams || [])].map(
                  (p) => (
                    <tr key={p.name} className="border-t border-supportops-border">
                      <td className="px-4 py-2 font-mono text-supportops-text font-medium">
                        {p.name}
                      </td>
                      <td className="px-4 py-2 text-supportops-text-light">{p.type}</td>
                      <td className="px-4 py-2">
                        {p.required ? (
                          <span className="text-supportops-danger font-medium">Yes</span>
                        ) : (
                          <span className="text-supportops-text-light">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-supportops-text-light">{p.description}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Try it */}
      <TryItPanel endpoint={endpoint} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("chat");

  const currentSection = apiSections.find((s) => s.id === activeSection) || apiSections[0];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="API Documentation"
        description="Integrate SupportOps AI with your systems"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-supportops-border bg-supportops-bg overflow-y-auto p-4 hidden lg:block">
          <nav className="space-y-1">
            {apiSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-supportops-primary text-white"
                      : "text-supportops-text-light hover:bg-supportops-surface hover:text-supportops-text"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {section.name}
                  <span className="ml-auto text-xs opacity-70">
                    {section.endpoints.length}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Mobile section selector */}
            <div className="lg:hidden">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value)}
                className="w-full px-3 py-2 border border-supportops-border rounded-lg bg-supportops-surface text-supportops-text text-sm focus:outline-none focus:ring-2 focus:ring-supportops-primary/30"
              >
                {apiSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Authentication Section */}
            <div className="border border-supportops-border rounded-xl bg-supportops-surface p-6 transition-theme">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-supportops-primary-50 rounded-lg">
                  <Key className="h-5 w-5 text-supportops-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-supportops-text">
                    Authentication
                  </h3>
                  <p className="text-sm text-supportops-text-light">
                    All API requests require authentication
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-supportops-text-light leading-relaxed">
                <p>
                  Include your API key in the request headers using the{" "}
                  <code className="px-1.5 py-0.5 bg-supportops-bg rounded text-supportops-text font-mono text-xs">
                    X-API-Key
                  </code>{" "}
                  header. You can generate and manage API keys from the{" "}
                  <span className="font-medium text-supportops-text">Settings</span> page.
                </p>
                <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 text-sm p-4 rounded-lg border border-gray-700 font-mono">
                  <span className="text-blue-400">curl</span>{" "}
                  <span className="text-green-400">-H</span>{" "}
                  <span className="text-amber-300">{'"X-API-Key: your_api_key_here"'}</span>{" "}
                  \<br />
                  {"  "}https://your-domain.com/api/conversations
                </div>
                <p>
                  API keys can be configured with different permissions. Keep your keys
                  secure and never expose them in client-side code. If a key is compromised,
                  revoke it immediately from the Settings page and generate a new one.
                </p>
              </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-supportops-primary-50 rounded-lg">
                <currentSection.icon className="h-5 w-5 text-supportops-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-supportops-text">
                  {currentSection.name}
                </h3>
                <p className="text-sm text-supportops-text-light">
                  {currentSection.endpoints.length} endpoint
                  {currentSection.endpoints.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-6">
              {currentSection.endpoints.map((ep, i) => (
                <EndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
