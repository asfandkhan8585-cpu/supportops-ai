"use client";

import { Header } from "@/components/layout/header";
import {
  ScrollText,
  MessageSquare,
  Ticket,
  Settings,
  BookOpen,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface ActivityData {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  userName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ActivityResponse {
  data: ActivityData[];
  pagination: { total: number; totalPages: number };
}

const entityTypes = [
  { value: "all", label: "All Types" },
  { value: "conversation", label: "Conversation" },
  { value: "ticket", label: "Ticket" },
  { value: "order_approval", label: "Order approval" },
  { value: "settings", label: "Settings" },
  { value: "knowledge", label: "Knowledge" },
  { value: "team", label: "Team" },
];

const entityConfig: Record<
  string,
  { icon: React.ElementType; bgColor: string; iconColor: string }
> = {
  conversation: {
    icon: MessageSquare,
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  ticket: {
    icon: Ticket,
    bgColor: "bg-orange-50",
    iconColor: "text-orange-600",
  },
  settings: {
    icon: Settings,
    bgColor: "bg-gray-100",
    iconColor: "text-gray-600",
  },
  knowledge: {
    icon: BookOpen,
    bgColor: "bg-green-50",
    iconColor: "text-green-600",
  },
  team: {
    icon: Users,
    bgColor: "bg-purple-50",
    iconColor: "text-purple-600",
  },
};

export default function ActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams({ page: String(page) });
    if (entityFilter !== "all") params.set("entity", entityFilter);
    if (actorFilter) params.set("actor", actorFilter);
    if (actionFilter) params.set("action", actionFilter);
    fetch(`/api/activity?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch activity");
        const json: ActivityResponse = await response.json();
        if (!controller.signal.aborted) setData(json);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, entityFilter, actorFilter, actionFilter]);

  const activities = data?.data ?? [];
  const totalPages = data?.pagination.totalPages || 1;
  const total = data?.pagination.total ?? 0;

  return (
    <>
      <Header
        title="Activity Log"
        description="Track all actions and changes"
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Filter Bar */}
        <div className="bg-supportops-surface rounded-xl border border-supportops-border p-3">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-supportops-text-light" />
            <select
              value={entityFilter}
              aria-label="Activity type"
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
            >
              {entityTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={actorFilter}
              aria-label="Activity source"
              onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text"
            >
              <option value="">All Sources</option>
              <option value="SupportOps AI">SupportOps AI</option>
              <option value="Customer portal">Customer portal</option>
            </select>
            <select
              value={actionFilter}
              aria-label="Activity action"
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text"
            >
              <option value="">All Actions</option>
              <option value="conversation.escalated">Human handoff</option>
              <option value="ticket.created">Ticket created</option>
              <option value="ticket.updated">Ticket updated</option>
              <option value="approval.requested">Approval requested</option>
              <option value="approval.approved">Approval approved</option>
              <option value="approval.rejected">Approval rejected</option>
            </select>
            <span className="text-sm text-supportops-text-light ml-auto">
              {total} {total === 1 ? "entry" : "entries"}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-supportops-surface rounded-xl border border-supportops-border">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-sm text-supportops-text-light">Loading...</div>
            </div>
          ) : loadError ? (
            <p role="alert" className="p-5 text-sm text-supportops-danger">Unable to load activity.</p>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="p-4 rounded-full bg-supportops-primary-50 mb-4">
                <ScrollText className="h-8 w-8 text-supportops-primary" />
              </div>
              <p className="font-medium text-supportops-text">No activity found</p>
              <p className="text-sm text-supportops-text-light mt-1">
                Actions and changes will appear here as they happen
              </p>
            </div>
          ) : (
            <div className="divide-y divide-supportops-border">
              {activities.map((activity) => {
                const config = entityConfig[activity.entity] || {
                  icon: ScrollText,
                  bgColor: "bg-gray-100",
                  iconColor: "text-gray-600",
                };
                const Icon = config.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-supportops-primary-50/30 transition-colors"
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg flex-shrink-0 mt-0.5",
                        config.bgColor
                      )}
                    >
                      <Icon className={cn("h-4 w-4", config.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-supportops-text">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-supportops-text-light">
                          {activity.userName}
                        </span>
                        <span className="text-xs text-supportops-text-light">
                          {formatRelativeTime(activity.createdAt)}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-xs font-medium",
                            activity.entity === "conversation"
                              ? "bg-blue-50 text-blue-700"
                              : activity.entity === "ticket"
                              ? "bg-orange-50 text-orange-700"
                              : activity.entity === "settings"
                              ? "bg-gray-100 text-gray-700"
                              : activity.entity === "knowledge"
                              ? "bg-green-50 text-green-700"
                              : activity.entity === "team"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                          )}
                        >
                          {activity.entity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-supportops-surface rounded-xl border border-supportops-border px-5 py-3">
            <p className="text-sm text-supportops-text-light">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors",
                  page <= 1
                    ? "text-supportops-text-light cursor-not-allowed"
                    : "text-supportops-text hover:bg-supportops-primary-50"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors",
                  page >= totalPages
                    ? "text-supportops-text-light cursor-not-allowed"
                    : "text-supportops-text hover:bg-supportops-primary-50"
                )}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
