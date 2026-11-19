"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/layout/header";

type Order = {
  id: string;
  number: string;
  status: string;
  customer: { name: string };
  delivery: { status: string; carrier: string | null; trackingNumber: string | null } | null;
};

type Approval = {
  id: string;
  type: "refund" | "cancellation";
  status: "pending" | "approved" | "rejected";
  reason: string;
  createdAt: string;
  conversationId: string | null;
  decision: { userName: string; createdAt: string } | null;
  order: { number: string; status: string; customer: { name: string } };
};

type Page<T> = { data: T[]; pagination: { totalPages: number } };
type Decision = "approve" | "reject";

const fieldClass = "rounded-lg border border-supportops-border bg-supportops-bg px-3 py-2 text-sm";
const buttonClass =
  "rounded-lg border border-supportops-border px-3 py-2 text-sm font-medium disabled:opacity-50";
const panelClass = "space-y-4 rounded-xl border border-supportops-border bg-supportops-surface p-4 sm:p-5";

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(
      payload?.error?.message || payload?.error || "The request could not be completed."
    );
  }
  return payload as T;
}

function PageControls({
  page,
  total,
  onChange,
  label,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  label: string;
}) {
  if (page === 1 && total <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 text-sm">
      <button
        type="button"
        className={buttonClass}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {Math.max(1, total)}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function OrdersDesk({ canDecide }: { canDecide: boolean }) {
  const [orders, setOrders] = useState<Page<Order> | null>(null);
  const [approvals, setApprovals] = useState<Page<Approval> | null>(null);
  const [search, setSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [approvalPage, setApprovalPage] = useState(1);
  const [approvalStatus, setApprovalStatus] = useState("pending");
  const [revision, setRevision] = useState(0);
  const [ordersError, setOrdersError] = useState("");
  const [approvalsError, setApprovalsError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ search, page: String(orderPage) });
    fetch(`/api/orders?${params}`, { signal: controller.signal })
      .then(readResponse<Page<Order>>)
      .then((result) => {
        setOrders(result);
        setOrdersError("");
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setOrdersError(error.message);
      });
    return () => controller.abort();
  }, [search, orderPage, revision]);

  useEffect(() => {
    if (!canDecide) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ status: approvalStatus, page: String(approvalPage) });
    fetch(`/api/admin/order-approvals?${params}`, { signal: controller.signal })
      .then(readResponse<Page<Approval>>)
      .then((result) => {
        const lastPage = Math.max(1, result.pagination.totalPages);
        if (approvalPage > lastPage) {
          setApprovalPage(lastPage);
          return;
        }
        setApprovals(result);
        setApprovalsError("");
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setApprovalsError(error.message);
      });
    return () => controller.abort();
  }, [canDecide, approvalStatus, approvalPage, revision]);

  function searchOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    if (query === search && orderPage === 1) return;
    setOrders(null);
    setOrdersError("");
    setOrderPage(1);
    setSearch(query);
  }

  async function decide(approval: Approval, decision: Decision) {
    setDeciding(true);
    setReceipt("");
    setDecisionError("");
    try {
      const response = await fetch(`/api/admin/order-approvals/${approval.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await readResponse<{
        approval: Pick<Approval, "status">;
        orderStatus: string;
      }>(response);
      setReceipt(
        `Request ${result.approval.status} for ${approval.order.number}. Order status: ${result.orderStatus}.`
      );
      setApprovals(
        (current) =>
          current && {
            ...current,
            data: current.data.map((item) =>
              item.id === approval.id ? { ...item, status: result.approval.status } : item
            ),
          }
      );
      setRevision((value) => value + 1);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Could not save the decision.");
      setRevision((value) => value + 1);
    } finally {
      setDeciding(false);
    }
  }

  return (
    <>
      <Header
        title="Orders"
        description="View order and delivery status and review customer requests"
      />
      <div className="flex-1 space-y-5 overflow-auto p-4 sm:p-6">
        {canDecide && (
          <section className={panelClass} aria-labelledby="approvals-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="approvals-heading" className="font-semibold">
                Order approvals
              </h2>
              <label className="flex items-center gap-2 text-sm">
                Status
                <select
                  className={fieldClass}
                  value={approvalStatus}
                  onChange={(event) => {
                    setApprovals(null);
                    setApprovalsError("");
                    setApprovalPage(1);
                    setApprovalStatus(event.target.value);
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>
            {receipt && (
              <p role="status" className="text-sm">
                {receipt}
              </p>
            )}
            {decisionError && (
              <p role="alert" className="text-sm text-supportops-danger">
                {decisionError}
              </p>
            )}
            {approvalsError ? (
              <p role="alert" className="text-sm text-supportops-danger">
                {approvalsError}
              </p>
            ) : !approvals ? (
              <p className="text-sm text-supportops-text-light">Loading approvals…</p>
            ) : approvals.data.length === 0 ? (
              <p className="text-sm text-supportops-text-light">No matching approval requests.</p>
            ) : (
              <ul className="divide-y divide-supportops-border">
                {approvals.data.map((approval) => (
                  <li key={approval.id} className="flex flex-wrap justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p className="font-medium">
                        <span className="capitalize">{approval.type}</span> for{" "}
                        {approval.order.number}
                      </p>
                      <p className="text-supportops-text-light">
                        {approval.order.customer.name} · Request {approval.status} · Order{" "}
                        {approval.order.status}
                      </p>
                      <p className="text-supportops-text-light">
                        Requested {new Date(approval.createdAt).toLocaleDateString()}
                        {approval.decision &&
                          ` · Decided ${new Date(approval.decision.createdAt).toLocaleString()} by ${approval.decision.userName}`}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{approval.reason}</p>
                      {approval.conversationId && (
                        <Link
                          href={`/conversations?id=${approval.conversationId}`}
                          className="text-supportops-primary underline"
                        >
                          View conversation
                        </Link>
                      )}
                    </div>
                    {approval.status === "pending" && (
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          disabled={deciding}
                          className={`${buttonClass} bg-supportops-primary text-white`}
                          onClick={() => decide(approval, "approve")}
                        >
                          Approve {approval.type}
                        </button>
                        <button
                          type="button"
                          disabled={deciding}
                          className={buttonClass}
                          onClick={() => decide(approval, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {approvals && (
              <PageControls
                page={approvalPage}
                total={approvals.pagination.totalPages}
                onChange={setApprovalPage}
                label="Approval pages"
              />
            )}
          </section>
        )}
        <section className={panelClass} aria-labelledby="orders-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="orders-heading" className="font-semibold">
              Order history
            </h2>
            <form onSubmit={searchOrders} className="flex flex-wrap gap-2">
              <input
                className={fieldClass}
                name="search"
                aria-label="Search by order number or customer"
                placeholder="Order number or customer"
                maxLength={100}
              />
              <button className={buttonClass}>Search</button>
            </form>
          </div>
          {ordersError ? (
            <p role="alert" className="text-sm text-supportops-danger">
              {ordersError}
            </p>
          ) : !orders ? (
            <p className="text-sm text-supportops-text-light">Loading orders…</p>
          ) : orders.data.length === 0 ? (
            <p className="text-sm text-supportops-text-light">No matching orders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-supportops-border text-supportops-text-light">
                  <tr>
                    <th className="p-2">Order</th>
                    <th className="p-2">Customer</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Delivery</th>
                    <th className="p-2">Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-supportops-border">
                  {orders.data.map((order) => (
                    <tr key={order.id}>
                      <td className="p-2 font-medium">{order.number}</td>
                      <td className="p-2">{order.customer.name}</td>
                      <td className="p-2 capitalize">{order.status}</td>
                      <td className="p-2 capitalize">
                        {order.delivery?.status.replaceAll("_", " ") ?? "—"}
                      </td>
                      <td className="p-2">
                        {[order.delivery?.carrier, order.delivery?.trackingNumber]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {orders && (
            <PageControls
              page={orderPage}
              total={orders.pagination.totalPages}
              onChange={setOrderPage}
              label="Order pages"
            />
          )}
        </section>
      </div>
    </>
  );
}
