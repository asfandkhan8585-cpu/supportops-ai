"use client";

import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { fetchPaginatedItems } from "@/lib/pagination";
import {
  Users,
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Mail,
  Phone,
  X,
  Loader2,
  UserCheck,
  UserX,
  Shield,
  Briefcase,
} from "lucide-react";
import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Department {
  id: string;
  name: string;
  description: string;
  email: string;
  _count: { members: number };
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  expertise: string;
  departmentId: string;
  department: { id: string; name: string };
  isAvailable: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-supportops-surface rounded-xl border border-supportops-border shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-supportops-border">
          <h3 className="text-lg font-semibold text-supportops-text">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-supportops-text-light hover:text-supportops-text hover:bg-supportops-primary-50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Department form
// ---------------------------------------------------------------------------

function DepartmentForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Department | null;
  onSubmit: (data: { name: string; description: string; email: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [email, setEmail] = useState(initial?.email || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, email });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-supportops-text mb-1.5">
          Name <span className="text-supportops-danger">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Customer Support"
          required
          className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-supportops-text mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this department"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-supportops-text mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="department@company.com"
          className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-supportops-text-light hover:text-supportops-text border border-supportops-border rounded-lg hover:bg-supportops-bg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-supportops-primary hover:bg-supportops-primary-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Update Department" : "Create Department"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Member form
// ---------------------------------------------------------------------------

function MemberForm({
  initial,
  departments,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Member | null;
  departments: Department[];
  onSubmit: (data: {
    name: string;
    email: string;
    phone: string;
    role: string;
    expertise: string;
    departmentId: string;
  }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [role, setRole] = useState(initial?.role || "member");
  const [expertise, setExpertise] = useState(initial?.expertise || "");
  const [departmentId, setDepartmentId] = useState(
    initial?.departmentId || departments[0]?.id || ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email, phone, role, expertise, departmentId });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-supportops-text mb-1.5">
            Name <span className="text-supportops-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            required
            className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-supportops-text mb-1.5">
            Email <span className="text-supportops-danger">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@company.com"
            required
            className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-supportops-text mb-1.5">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-supportops-text mb-1.5">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
          >
            <option value="member">Member</option>
            <option value="lead">Lead</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-supportops-text mb-1.5">
          Department <span className="text-supportops-danger">*</span>
        </label>
        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
        >
          {departments.length === 0 && (
            <option value="">No departments available</option>
          )}
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-supportops-text mb-1.5">
          Expertise
        </label>
        <input
          type="text"
          value={expertise}
          onChange={(e) => setExpertise(e.target.value)}
          placeholder="e.g. Billing, Technical Support, Sales"
          className="w-full px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-bg text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-supportops-text-light hover:text-supportops-text border border-supportops-border rounded-lg hover:bg-supportops-bg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim() || !email.trim() || !departmentId}
          className="px-4 py-2 text-sm font-medium text-white bg-supportops-primary hover:bg-supportops-primary-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Update Member" : "Add Member"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

function DeleteConfirm({
  label,
  onConfirm,
  onCancel,
  loading,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-supportops-text">
        Are you sure you want to delete <strong>{label}</strong>? This action
        cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-supportops-text-light hover:text-supportops-text border border-supportops-border rounded-lg hover:bg-supportops-bg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-supportops-danger hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role badge helper
// ---------------------------------------------------------------------------

function getRoleBadge(role: string) {
  const map: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    manager: "bg-blue-100 text-blue-700",
    lead: "bg-supportops-primary-100 text-supportops-primary-dark",
    member: "bg-gray-100 text-gray-700",
  };
  return map[role] || map.member;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<"departments" | "members">(
    "departments"
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Modal state
  const [deptModal, setDeptModal] = useState<{
    open: boolean;
    editing: Department | null;
  }>({ open: false, editing: null });
  const [memberModal, setMemberModal] = useState<{
    open: boolean;
    editing: Member | null;
  }>({ open: false, editing: null });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: "department" | "member";
    id: string;
    label: string;
  } | null>(null);

  // ---- Data fetching ----

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setLoadError(false);
    const membersUrl = filterDept ? `/api/team/members?departmentId=${encodeURIComponent(filterDept)}` : "/api/team/members";
    Promise.all([
      fetchPaginatedItems<Department>("/api/team/departments", signal),
      fetchPaginatedItems<Member>(membersUrl, signal),
    ]).then(([loadedDepartments, loadedMembers]) => {
      if (signal.aborted) return;
      setDepartments(loadedDepartments);
      setMembers(loadedMembers);
    }).catch(() => { if (!signal.aborted) setLoadError(true); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filterDept, revision]);

  // ---- Department CRUD ----

  const handleDeptSubmit = async (data: {
    name: string;
    description: string;
    email: string;
  }) => {
    setActionLoading(true);
    try {
      const isEdit = !!deptModal.editing;
      const url = isEdit
        ? `/api/team/departments/${deptModal.editing!.id}`
        : "/api/team/departments";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setDeptModal({ open: false, editing: null });
        setRevision((current) => current + 1);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Member CRUD ----

  const handleMemberSubmit = async (data: {
    name: string;
    email: string;
    phone: string;
    role: string;
    expertise: string;
    departmentId: string;
  }) => {
    setActionLoading(true);
    try {
      const isEdit = !!memberModal.editing;
      const url = isEdit
        ? `/api/team/members/${memberModal.editing!.id}`
        : "/api/team/members";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setMemberModal({ open: false, editing: null });
        setRevision((current) => current + 1);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAvailability = async (member: Member) => {
    try {
      const res = await fetch(`/api/team/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...member,
          isAvailable: !member.isAvailable,
        }),
      });
      if (res.ok) setRevision((current) => current + 1);
    } catch (err) {
      console.error("Failed to toggle availability:", err);
    }
  };

  // ---- Delete ----

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActionLoading(true);
    try {
      const url =
        deleteModal.type === "department"
          ? `/api/team/departments/${deleteModal.id}`
          : `/api/team/members/${deleteModal.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setDeleteModal(null);
        if (deleteModal.type === "department" && deleteModal.id === filterDept) setFilterDept("");
        setRevision((current) => current + 1);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Filtering ----

  const filteredDepartments = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.expertise.toLowerCase().includes(search.toLowerCase()) ||
      m.department.name.toLowerCase().includes(search.toLowerCase())
  );

  // ---- Render ----

  const tabs = [
    { key: "departments" as const, label: "Departments", icon: Building2 },
    { key: "members" as const, label: "Members", icon: Users },
  ];

  return (
    <>
      <Header
        title="Team"
        description="Manage departments and team members"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Tabs + actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-1 bg-supportops-bg p-1 rounded-lg border border-supportops-border">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearch("");
                  setFilterDept("");
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === tab.key
                    ? "bg-supportops-surface text-supportops-primary shadow-sm"
                    : "text-supportops-text-light hover:text-supportops-text"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "members" && departments.length > 0 && (
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-surface text-supportops-text focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-supportops-text-light" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === "departments"
                    ? "Search departments..."
                    : "Search members..."
                }
                className="pl-9 pr-3 py-2 text-sm border border-supportops-border rounded-lg bg-supportops-surface text-supportops-text placeholder:text-supportops-text-light/60 focus:outline-none focus:ring-2 focus:ring-supportops-primary/30 focus:border-supportops-primary w-56"
              />
            </div>

            <button
              onClick={() => {
                if (activeTab === "departments") {
                  setDeptModal({ open: true, editing: null });
                } else {
                  setMemberModal({ open: true, editing: null });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-supportops-primary hover:bg-supportops-primary-dark rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              {activeTab === "departments" ? "Add Department" : "Add Member"}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-supportops-primary" />
          </div>
        )}

        {/* Departments tab */}
        {!loading && loadError && (
          <p role="alert" className="text-sm text-supportops-danger">Unable to load the team.</p>
        )}

        {!loading && !loadError && activeTab === "departments" && (
          <>
            {filteredDepartments.length === 0 ? (
              <div className="bg-supportops-surface rounded-xl border border-supportops-border px-6 py-16 text-center">
                <Building2 className="h-12 w-12 mx-auto text-supportops-text-light/40 mb-4" />
                <p className="text-lg font-medium text-supportops-text">
                  {search ? "No departments found" : "No departments yet"}
                </p>
                <p className="text-sm text-supportops-text-light mt-1">
                  {search
                    ? "Try a different search term."
                    : "Create your first department to organize your team."}
                </p>
                {!search && (
                  <button
                    onClick={() =>
                      setDeptModal({ open: true, editing: null })
                    }
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-supportops-primary hover:bg-supportops-primary-dark rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create Department
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDepartments.map((dept) => (
                  <div
                    key={dept.id}
                    className="bg-supportops-surface rounded-xl border border-supportops-border p-5 hover:border-supportops-primary/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-supportops-primary-50 text-supportops-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-supportops-text">
                            {dept.name}
                          </h3>
                          <p className="text-xs text-supportops-text-light mt-0.5">
                            {dept._count.members}{" "}
                            {dept._count.members === 1 ? "member" : "members"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            setDeptModal({ open: true, editing: dept })
                          }
                          className="p-1.5 text-supportops-text-light hover:text-supportops-primary hover:bg-supportops-primary-50 rounded-lg transition-colors"
                          title="Edit department"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteModal({
                              open: true,
                              type: "department",
                              id: dept.id,
                              label: dept.name,
                            })
                          }
                          className="p-1.5 text-supportops-text-light hover:text-supportops-danger hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {dept.description && (
                      <p className="text-sm text-supportops-text-light mt-3 line-clamp-2">
                        {dept.description}
                      </p>
                    )}

                    {dept.email && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-supportops-text-light">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{dept.email}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Members tab */}
        {!loading && !loadError && activeTab === "members" && (
          <>
            {filteredMembers.length === 0 ? (
              <div className="bg-supportops-surface rounded-xl border border-supportops-border px-6 py-16 text-center">
                <Users className="h-12 w-12 mx-auto text-supportops-text-light/40 mb-4" />
                <p className="text-lg font-medium text-supportops-text">
                  {search || filterDept
                    ? "No members found"
                    : "No team members yet"}
                </p>
                <p className="text-sm text-supportops-text-light mt-1">
                  {search || filterDept
                    ? "Try adjusting your search or filter."
                    : departments.length === 0
                      ? "Create a department first, then add team members."
                      : "Add your first team member to get started."}
                </p>
                {!search && !filterDept && departments.length > 0 && (
                  <button
                    onClick={() =>
                      setMemberModal({ open: true, editing: null })
                    }
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-supportops-primary hover:bg-supportops-primary-dark rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Member
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-supportops-surface rounded-xl border border-supportops-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-supportops-border bg-supportops-bg/50">
                        <th className="text-left px-5 py-3 font-medium text-supportops-text-light">
                          Name
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-supportops-text-light">
                          Contact
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-supportops-text-light">
                          Department
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-supportops-text-light">
                          Role
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-supportops-text-light">
                          Expertise
                        </th>
                        <th className="text-left px-5 py-3 font-medium text-supportops-text-light">
                          Status
                        </th>
                        <th className="text-right px-5 py-3 font-medium text-supportops-text-light">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-supportops-border">
                      {filteredMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-supportops-primary-50/30 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-supportops-primary-100 text-supportops-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                {member.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <span className="font-medium text-supportops-text">
                                {member.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-supportops-text-light">
                                <Mail className="h-3.5 w-3.5" />
                                <span>{member.email}</span>
                              </div>
                              {member.phone && (
                                <div className="flex items-center gap-1.5 text-supportops-text-light">
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>{member.phone}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 text-supportops-text">
                              <Building2 className="h-3.5 w-3.5 text-supportops-text-light" />
                              {member.department.name}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                                getRoleBadge(member.role)
                              )}
                            >
                              {member.role === "admin" && (
                                <Shield className="h-3 w-3" />
                              )}
                              {member.role === "manager" && (
                                <Briefcase className="h-3 w-3" />
                              )}
                              {member.role}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-supportops-text-light max-w-[200px] truncate">
                            {member.expertise || "--"}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() =>
                                handleToggleAvailability(member)
                              }
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                                member.isAvailable
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              )}
                            >
                              {member.isAvailable ? (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  Available
                                </>
                              ) : (
                                <>
                                  <UserX className="h-3 w-3" />
                                  Unavailable
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setMemberModal({
                                    open: true,
                                    editing: member,
                                  })
                                }
                                className="p-1.5 text-supportops-text-light hover:text-supportops-primary hover:bg-supportops-primary-50 rounded-lg transition-colors"
                                title="Edit member"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    open: true,
                                    type: "member",
                                    id: member.id,
                                    label: member.name,
                                  })
                                }
                                className="p-1.5 text-supportops-text-light hover:text-supportops-danger hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete member"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---- Modals ---- */}

      <Modal
        open={deptModal.open}
        onClose={() => setDeptModal({ open: false, editing: null })}
        title={deptModal.editing ? "Edit Department" : "New Department"}
      >
        <DepartmentForm
          initial={deptModal.editing}
          onSubmit={handleDeptSubmit}
          onCancel={() => setDeptModal({ open: false, editing: null })}
          loading={actionLoading}
        />
      </Modal>

      <Modal
        open={memberModal.open}
        onClose={() => setMemberModal({ open: false, editing: null })}
        title={memberModal.editing ? "Edit Member" : "New Member"}
      >
        <MemberForm
          initial={memberModal.editing}
          departments={departments}
          onSubmit={handleMemberSubmit}
          onCancel={() => setMemberModal({ open: false, editing: null })}
          loading={actionLoading}
        />
      </Modal>

      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={
          deleteModal?.type === "department"
            ? "Delete Department"
            : "Delete Member"
        }
      >
        <DeleteConfirm
          label={deleteModal?.label || ""}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(null)}
          loading={actionLoading}
        />
      </Modal>
    </>
  );
}
