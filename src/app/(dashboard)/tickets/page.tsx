"use client";

import { Header } from "@/components/layout/header";
import Link from "next/link";
import {
  Ticket,
  Search,
  Plus,
  X,
  User,
  MessageSquare,
  CheckCircle2,
  Clock,
  CircleDot,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPaginatedItems } from "@/lib/pagination";
import { ticketCategoryLabels } from "@/lib/ticket-categories";
import {
  cn,
  formatRelativeTime,
  formatDate,
  getStatusColor,
  getPriorityColor,
} from "@/lib/utils";

interface TicketData {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  priority: string;
  resolution: string;
  conversationId: string | null;
  departmentId: string | null;
  assignedToId: string | null;
  order: { id: string; number: string } | null;
  conversation: {
    id: string;
    customerName: string;
    channel: string;
    status: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentData {
  id: string;
  name: string;
}

const ticketStatuses = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const ticketPriorities = [
  { value: "all", label: "All Priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const statusIcons: Record<string, React.ElementType> = {
  open: CircleDot,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: CheckCircle2,
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const ticketCategories = Object.entries(ticketCategoryLabels);
const defaultCreateForm = {
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  category: "general",
  orderNumber: "",
  departmentId: "",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [orderDraft, setOrderDraft] = useState("");
  const listRequest = useRef<AbortController | null>(null);
  const [createForm, setCreateForm] = useState(defaultCreateForm);

  const fetchTickets = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (departmentFilter !== "all")
        params.set("departmentId", departmentFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/tickets?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const result: { data: TicketData[]; pagination: { totalPages: number } } = await res.json();
      if (!controller.signal.aborted) {
        setTickets(result.data);
        setTotalPages(result.pagination.totalPages);
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages));
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadError(true);
      console.error("Failed to fetch tickets:", error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, categoryFilter, departmentFilter, searchQuery]);

  const fetchDepartments = useCallback(async (signal: AbortSignal) => {
    try {
      const allDepartments = await fetchPaginatedItems<DepartmentData>("/api/team/departments", signal);
      if (!signal.aborted) setDepartments(allDepartments);
    } catch (error) {
      if (!signal.aborted) console.error("Failed to fetch departments:", error);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    return () => listRequest.current?.abort();
  }, [fetchTickets]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDepartments(controller.signal);
    return () => controller.abort();
  }, [fetchDepartments]);

  const handleCreateTicket = async () => {
    if (!createForm.title.trim()) return;
    setSaving(true);
    setMutationError("");
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          departmentId: createForm.departmentId || undefined,
        }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null);
        setMutationError(result?.error || "Failed to create the ticket.");
        return;
      }
      setShowCreateModal(false);
      setCreateForm(defaultCreateForm);
      if (page === 1) fetchTickets();
      else setPage(1);
    } catch (error) {
      setMutationError("Failed to create the ticket.");
      console.error("Failed to create ticket:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTicket = async (
    id: string,
    updates: Record<string, unknown>
  ) => {
    setMutationError("");
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null);
        setMutationError(result?.error || "Failed to update the ticket.");
        return;
      }
      const updated: TicketData = await res.json();
      setSelectedTicket((current) => current?.id === updated.id ? updated : current);
      fetchTickets();
    } catch (error) {
      setMutationError("Failed to update the ticket.");
      console.error("Failed to update ticket:", error);
    }
  };

  const handleDeleteTicket = async (id: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch (error) {
      console.error("Failed to delete ticket:", error);
    }
  };

  function openCreateModal() {
    setMutationError("");
    setShowCreateModal(true);
  }

  function openTicket(ticket: TicketData) {
    setMutationError("");
    setOrderDraft(ticket.order?.number ?? "");
    setSelectedTicket(ticket);
  }

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in_progress"
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;

  return (
    <>
      <Header
        title="Tickets"
        description="Track and manage customer issues"
        actions={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-supportops-primary text-white rounded-lg hover:bg-supportops-primary-dark transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-supportops-surface rounded-xl border border-supportops-border px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-50">
              <CircleDot className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-supportops-text-light">Open on this page</p>
              <p className="text-lg font-semibold text-supportops-text">
                {openCount}
              </p>
            </div>
          </div>
          <div className="bg-supportops-surface rounded-xl border border-supportops-border px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-supportops-text-light">In progress on this page</p>
              <p className="text-lg font-semibold text-supportops-text">
                {inProgressCount}
              </p>
            </div>
          </div>
          <div className="bg-supportops-surface rounded-xl border border-supportops-border px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-supportops-text-light">Resolved on this page</p>
              <p className="text-lg font-semibold text-supportops-text">
                {resolvedCount}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-supportops-surface rounded-xl border border-supportops-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-supportops-text-light" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
            >
              {ticketStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
            >
              {ticketPriorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              aria-label="Ticket category"
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text"
            >
              <option value="all">All Categories</option>
              {ticketCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-supportops-surface rounded-xl border border-supportops-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-sm text-supportops-text-light">Loading...</div>
            </div>
          ) : loadError ? (
            <p role="alert" className="p-5 text-sm text-supportops-danger">Unable to load tickets.</p>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="p-4 rounded-full bg-supportops-primary-50 mb-4">
                <Ticket className="h-8 w-8 text-supportops-primary" />
              </div>
              <p className="font-medium text-supportops-text">No tickets found</p>
              <p className="text-sm text-supportops-text-light mt-1">
                Create a ticket to start tracking customer issues
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-supportops-primary text-white rounded-lg hover:bg-supportops-primary-dark transition-colors text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Ticket
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-supportops-border bg-supportops-bg/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-supportops-text-light uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-supportops-text-light uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-supportops-text-light uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-supportops-text-light uppercase tracking-wider hidden md:table-cell">
                      Department
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-supportops-text-light uppercase tracking-wider hidden lg:table-cell">
                      Assigned To
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-supportops-text-light uppercase tracking-wider hidden lg:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-supportops-border">
                  {tickets.map((ticket) => {
                    const StatusIcon =
                      statusIcons[ticket.status] || CircleDot;

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => openTicket(ticket)}
                        className="hover:bg-supportops-primary-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="block text-left text-sm font-medium text-supportops-text truncate max-w-[280px]"
                                onClick={(event) => { event.stopPropagation(); openTicket(ticket); }}
                              >
                                {ticket.title}
                              </button>
                              <p className="text-xs text-supportops-text-light mt-0.5">
                                {[
                                  ticketCategoryLabels[ticket.category as keyof typeof ticketCategoryLabels] ?? ticket.category,
                                  ticket.conversation?.customerName,
                                  ticket.order?.number,
                                ].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1",
                              getStatusColor(ticket.status)
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {ticket.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              getPriorityColor(ticket.priority)
                            )}
                          >
                            {priorityLabels[ticket.priority] || ticket.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-supportops-text-light">
                            {ticket.department?.name || "--"}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-supportops-text-light">
                            {ticket.assignedTo?.name || "Unassigned"}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-supportops-text-light">
                            {formatRelativeTime(ticket.createdAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {!loadError && totalPages > 1 && (
          <nav aria-label="Ticket pages" className="flex items-center justify-between gap-3 text-sm">
            <button type="button" className="px-3 py-2 border border-supportops-border rounded-lg disabled:opacity-50"
              onClick={() => setPage(page - 1)} disabled={loading || page <= 1}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="px-3 py-2 border border-supportops-border rounded-lg disabled:opacity-50"
              onClick={() => setPage(page + 1)} disabled={loading || page >= totalPages}>
              Next
            </button>
          </nav>
        )}
      </div>

      {/* Ticket Detail Panel */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedTicket(null)}
          />
          <div className="relative w-full max-w-lg bg-supportops-surface shadow-xl flex flex-col animate-in slide-in-from-right">
            {/* Detail Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-supportops-border">
              <h3 className="font-semibold text-supportops-text text-lg">
                Ticket Details
              </h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 hover:bg-supportops-primary-50 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-supportops-text-light" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {mutationError && <p role="alert" className="text-sm text-supportops-danger">{mutationError}</p>}
              {/* Title */}
              <div>
                <h4 className="text-lg font-semibold text-supportops-text">
                  {selectedTicket.title}
                </h4>
                <p className="text-xs text-supportops-text-light mt-1">
                  Created {formatDate(selectedTicket.createdAt)}
                </p>
              </div>

              {/* Status and Priority Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-supportops-text-light mb-1">
                    Status
                  </label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) =>
                      handleUpdateTicket(selectedTicket.id, {
                        status: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
                  >
                    {ticketStatuses
                      .filter((s) => s.value !== "all")
                      .map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-supportops-text-light mb-1">
                    Priority
                  </label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) =>
                      handleUpdateTicket(selectedTicket.id, {
                        priority: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
                  >
                    {ticketPriorities
                      .filter((p) => p.value !== "all")
                      .map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <label className="block text-xs font-medium text-supportops-text-light">
                Category
                <select
                  value={selectedTicket.category}
                  onChange={(e) => handleUpdateTicket(selectedTicket.id, { category: e.target.value })}
                  className="mt-1 w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text"
                >
                  {ticketCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const orderNumber = orderDraft.trim();
                  setOrderDraft(orderNumber);
                  handleUpdateTicket(selectedTicket.id, { orderNumber: orderNumber || null });
                }}
              >
                <label htmlFor="ticket-order" className="block text-xs font-medium text-supportops-text-light mb-1">Linked Order</label>
                <div className="flex gap-2">
                  <input
                    id="ticket-order"
                    value={orderDraft}
                    onChange={(event) => setOrderDraft(event.target.value)}
                    placeholder="Order number"
                    maxLength={100}
                    className="min-w-0 flex-1 px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg"
                  />
                  <button type="submit" disabled={orderDraft.trim() === (selectedTicket.order?.number ?? "")}
                    className="px-3 py-2 border border-supportops-border rounded-lg text-sm disabled:opacity-50">
                    Save Order
                  </button>
                </div>
              </form>

              {/* Department */}
              <div>
                <label className="block text-xs font-medium text-supportops-text-light mb-1">
                  Department
                </label>
                <select
                  value={selectedTicket.departmentId || ""}
                  onChange={(e) =>
                    handleUpdateTicket(selectedTicket.id, {
                      departmentId: e.target.value || null,
                    })
                  }
                  className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-xs font-medium text-supportops-text-light mb-1">
                  Assigned To
                </label>
                <div className="flex items-center gap-2 px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg">
                  <User className="h-4 w-4 text-supportops-text-light" />
                  <span className="text-sm text-supportops-text">
                    {selectedTicket.assignedTo?.name || "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-supportops-text-light mb-1">
                  Description
                </label>
                <div className="px-3 py-2.5 border border-supportops-border rounded-lg bg-supportops-bg min-h-[80px]">
                  <p className="text-sm text-supportops-text whitespace-pre-wrap">
                    {selectedTicket.description || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Linked Conversation */}
              {selectedTicket.conversation && (
                <div>
                  <label className="block text-xs font-medium text-supportops-text-light mb-1">
                    Linked Conversation
                  </label>
                  <div className="flex items-center gap-3 px-3 py-2.5 border border-supportops-border rounded-lg bg-supportops-bg">
                    <MessageSquare className="h-4 w-4 text-supportops-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-supportops-text truncate">
                        {selectedTicket.conversation.customerName}
                      </p>
                      <p className="text-xs text-supportops-text-light">
                        {selectedTicket.conversation.channel} --{" "}
                        {selectedTicket.conversation.status}
                      </p>
                    </div>
                    <Link
                      href={`/conversations?id=${encodeURIComponent(selectedTicket.conversation.id)}`}
                      aria-label="Open linked conversation"
                      className="p-1 hover:bg-supportops-primary-50 rounded transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-supportops-primary" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Resolution */}
              <div>
                <label className="block text-xs font-medium text-supportops-text-light mb-1">
                  Resolution
                </label>
                <textarea
                  value={selectedTicket.resolution}
                  onChange={(e) => {
                    setSelectedTicket({
                      ...selectedTicket,
                      resolution: e.target.value,
                    });
                  }}
                  onBlur={() =>
                    handleUpdateTicket(selectedTicket.id, {
                      resolution: selectedTicket.resolution,
                    })
                  }
                  placeholder="Add resolution notes..."
                  rows={3}
                  className="w-full text-sm px-3 py-2.5 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary resize-none"
                />
              </div>
            </div>

            {/* Detail Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-supportops-border">
              <button
                onClick={() => handleDeleteTicket(selectedTicket.id)}
                className="text-sm text-supportops-danger hover:text-red-700 font-medium transition-colors"
              >
                Delete Ticket
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-sm font-medium bg-supportops-primary text-white rounded-lg hover:bg-supportops-primary-dark transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative w-full max-w-md mx-4 max-h-[calc(100dvh-2rem)] overflow-y-auto bg-supportops-surface rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-supportops-border">
              <h3 className="font-semibold text-supportops-text text-lg">
                Create New Ticket
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-supportops-primary-50 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-supportops-text-light" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {mutationError && <p role="alert" className="text-sm text-supportops-danger">{mutationError}</p>}
              <div>
                <label className="block text-sm font-medium text-supportops-text mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  placeholder="Enter ticket title..."
                  className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-supportops-text mb-1">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-supportops-text mb-1">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        priority: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
                  >
                    {ticketPriorities
                      .filter((p) => p.value !== "all")
                      .map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-supportops-text mb-1">
                    Department
                  </label>
                  <select
                    value={createForm.departmentId}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        departmentId: e.target.value,
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 text-supportops-text"
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-supportops-text">
                  Category
                  <select
                    value={createForm.category}
                    onChange={(event) => setCreateForm({ ...createForm, category: event.target.value })}
                    className="mt-1 w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg"
                  >
                    {ticketCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-supportops-text">
                  Order Number
                  <input
                    value={createForm.orderNumber}
                    onChange={(event) => setCreateForm({ ...createForm, orderNumber: event.target.value })}
                    maxLength={100}
                    className="mt-1 w-full text-sm px-3 py-2 border border-supportops-border rounded-lg bg-supportops-bg"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-supportops-border">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-supportops-text hover:bg-supportops-primary-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!createForm.title.trim() || saving}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  createForm.title.trim() && !saving
                    ? "bg-supportops-primary text-white hover:bg-supportops-primary-dark"
                    : "bg-supportops-border text-supportops-text-light cursor-not-allowed"
                )}
              >
                {saving ? "Creating..." : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
