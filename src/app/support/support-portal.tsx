"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";

interface ConversationPreview {
  id: string;
  title: string;
  status: string;
}

interface Conversation {
  id: string;
  status: string;
  messages: { id: string; role: string; content: string }[];
}

interface Order {
  number: string;
  status: string;
  placedAt: string;
  availableAction: OrderAction | null;
  latestRequest: { type: OrderAction; status: "pending" | "approved" | "rejected" } | null;
  delivery: {
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
  } | null;
}

type OrderAction = "refund" | "cancellation";

const inputClass = "w-full rounded-lg border border-supportops-border bg-supportops-surface p-2.5";
const buttonClass =
  "rounded-lg bg-supportops-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const panelClass = "rounded-xl border border-supportops-border bg-supportops-surface p-5";
const formatStatus = (value: string) => value.replaceAll("_", " ");
const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value)
  );

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message || "Support is temporarily unavailable. Please try again."
    );
  }
  return data as T;
}

export function SupportPortal({ initialName }: { initialName: string | null }) {
  const [name, setName] = useState(initialName);
  const [conversations, setConversations] = useState<ConversationPreview[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [orderRequest, setOrderRequest] = useState<{ number: string; type: OrderAction } | null>(
    null
  );
  const [orderReceipt, setOrderReceipt] = useState("");
  const activeId = active?.id;
  const isEscalated = active?.status === "escalated";

  useEffect(() => {
    if (!name) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    fetch("/api/customer/chat", options)
      .then(readResponse<{ conversations: ConversationPreview[] }>)
      .then(({ conversations }) => {
        setConversations(conversations);
        setHistoryError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryError("Could not load conversations.");
      });
    return () => controller.abort();
  }, [name, refresh]);

  useEffect(() => {
    if (!name) return;
    const controller = new AbortController();
    fetch(`/api/customer/orders?page=${orderPage}`, { signal: controller.signal })
      .then(readResponse<{ orders: Order[]; hasMore: boolean }>)
      .then(({ orders, hasMore }) => {
        setOrders(orders);
        setHasMoreOrders(hasMore);
        setOrdersError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setOrdersError("Could not load orders.");
      });
    return () => controller.abort();
  }, [name, orderPage, refresh]);

  useEffect(() => {
    if (!activeId || !isEscalated || pending) return;
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/customer/chat?id=${encodeURIComponent(activeId)}`, {
          signal: controller.signal,
        });
        if (response.ok && !controller.signal.aborted) {
          const conversation = await readResponse<Conversation>(response);
          if (!controller.signal.aborted) setActive(conversation);
        }
      } catch {
        // Transient polling errors are retried on the next tick.
      }
    }, 5000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [activeId, isEscalated, pending]);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await run(async () => {
      const response = await fetch("/api/customer/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }),
      });
      setName((await readResponse<{ name: string }>(response)).name);
    });
  }

  async function signOut() {
    await run(async () => {
      const response = await fetch("/api/customer/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      setName(null);
      setActive(null);
      setConversations(null);
      setOrders(null);
      setOrderPage(1);
      setHasMoreOrders(false);
      setHistoryError("");
      setOrdersError("");
      setMessage("");
      setOrderRequest(null);
      setOrderReceipt("");
    });
  }

  async function openConversation(id: string) {
    await run(async () => {
      setActive(
        await readResponse<Conversation>(
          await fetch(`/api/customer/chat?id=${encodeURIComponent(id)}`)
        )
      );
      setMessage("");
    });
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    await run(async () => {
      const response = await fetch("/api/customer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: active?.id }),
      });
      if (response.status === 503) {
        const failure = await response
          .clone()
          .json()
          .catch(() => null);
        if (typeof failure?.conversationId === "string") {
          const saved = await fetch(
            `/api/customer/chat?id=${encodeURIComponent(failure.conversationId)}`
          )
            .then(readResponse<Conversation>)
            .catch(() => null);
          if (saved) {
            setActive(saved);
            if (
              saved.messages.at(-1)?.role === "customer" &&
              saved.messages.at(-1)?.content === text
            ) {
              setMessage("");
            }
            setRefresh((value) => value + 1);
          }
        }
      }
      const conversation = await readResponse<Conversation>(response);
      setActive(conversation);
      setMessage("");
      setConversations((previous) => [
        {
          id: conversation.id,
          status: conversation.status,
          title: previous?.find(({ id }) => id === conversation.id)?.title ?? text.slice(0, 80),
        },
        ...(previous ?? []).filter(({ id }) => id !== conversation.id),
      ]);
    });
  }

  async function submitOrderRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderRequest) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason) {
      setError("Enter a reason for your request.");
      return;
    }
    await run(async () => {
      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderRequest.number,
          type: orderRequest.type,
          reason,
          ...(active?.status === "active" && { conversationId: active.id }),
        }),
      });
      const { approval } = await readResponse<{ approval: { id: string } }>(response);
      setOrderReceipt(
        `Your ${orderRequest.type} request is pending administrator approval. Reference ${approval.id}.`
      );
      setOrderRequest(null);
      setRefresh((value) => value + 1);
    });
  }

  async function requestHumanSupport() {
    if (!activeId) return;
    await run(async () => {
      const response = await fetch("/api/customer/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId }),
      });
      setActive(await readResponse<Conversation>(response));
      setRefresh((value) => value + 1);
    });
  }

  function changeOrderPage(page: number) {
    setOrderRequest(null);
    setOrders(null);
    setHasMoreOrders(false);
    setOrderPage(page);
  }

  return (
    <main className="min-h-screen bg-supportops-bg px-4 py-8 text-supportops-text sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/supportops.svg" width={42} height={42} alt="" />
            <h1 className="text-xl font-semibold">NovaCart Support</h1>
          </div>
          {name && (
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="rounded-lg border border-supportops-border px-3 py-2 text-sm"
            >
              Sign out
            </button>
          )}
        </header>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-400/40 p-3 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {!name ? (
          <form onSubmit={signIn} className={`${panelClass} mx-auto max-w-sm space-y-4`}>
            <h2 className="text-lg font-semibold">Sign in</h2>
            <label className="block text-sm">
              Email
              <input
                className={`${inputClass} mt-1`}
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                className={`${inputClass} mt-1`}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className={buttonClass} disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <section className={panelClass} aria-label="Support chat">
              <h2 className="text-lg font-semibold">Support chat</h2>
              <p className="mt-1 text-sm text-supportops-text-light">{name}</p>
              {active && (
                <div
                  className="mt-4 max-h-[55vh] space-y-3 overflow-auto"
                  role="log"
                  aria-label="Conversation messages"
                >
                  {active.messages.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg px-3 py-2 ${item.role === "customer" ? "ml-6 bg-supportops-primary-50" : "mr-6 border border-supportops-border"}`}
                    >
                      <p className="text-xs font-medium text-supportops-text-light">
                        {item.role === "customer" ? "You" : "Support"}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {active?.status === "escalated" && (
                <p className="mt-4 text-sm font-medium">Waiting for the support team.</p>
              )}
              {active?.status === "closed" ? (
                <p className="mt-4 text-sm">This conversation is closed.</p>
              ) : (
                <form onSubmit={sendMessage} className="mt-4 space-y-2">
                  <label htmlFor="support-message" className="text-sm font-medium">
                    Message
                  </label>
                  <textarea
                    id="support-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    disabled={pending}
                    maxLength={10000}
                    rows={3}
                    className={inputClass}
                  />
                  <button className={buttonClass} disabled={pending || !message.trim()}>
                    {pending ? "Please wait…" : "Send message"}
                  </button>
                </form>
              )}
              {active && active.status !== "closed" && !isEscalated && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={requestHumanSupport}
                  className="mt-3 text-sm text-supportops-primary underline disabled:opacity-50"
                >
                  Request human support
                </button>
              )}
            </section>
            <aside className="space-y-4">
              <section className={panelClass} aria-label="Conversation history">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Conversations</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(null);
                      setMessage("");
                    }}
                    disabled={pending || !active}
                    className="text-sm font-medium text-supportops-primary disabled:opacity-50"
                  >
                    New chat
                  </button>
                </div>
                {conversations?.length === 0 && (
                  <p className="mt-2 text-sm text-supportops-text-light">No conversations yet.</p>
                )}
                {conversations === null && !historyError && (
                  <p className="mt-2 text-sm text-supportops-text-light">Loading…</p>
                )}
                {historyError && (
                  <p className="mt-2 text-sm" role="status">
                    {historyError}{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setRefresh((value) => value + 1)}
                    >
                      Retry
                    </button>
                  </p>
                )}
                <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
                  {conversations?.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={active?.id === item.id}
                        onClick={() => openConversation(item.id)}
                        disabled={pending}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-supportops-primary-50 aria-pressed:bg-supportops-primary-50"
                      >
                        <span className="block truncate">{item.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={panelClass} aria-label="My orders">
                <h2 className="font-semibold">My orders</h2>
                {orderReceipt && (
                  <p className="mt-2 break-words text-sm" role="status">
                    {orderReceipt}
                  </p>
                )}
                {orders?.length === 0 && (
                  <p className="mt-2 text-sm text-supportops-text-light">No orders on this account.</p>
                )}
                {orders === null && !ordersError && (
                  <p className="mt-2 text-sm text-supportops-text-light">Loading…</p>
                )}
                {ordersError && (
                  <p className="mt-2 text-sm" role="status">
                    {ordersError}{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setRefresh((value) => value + 1)}
                    >
                      Retry
                    </button>
                  </p>
                )}
                <ul className="mt-2 max-h-96 space-y-3 overflow-auto text-sm">
                  {orders?.map(
                    ({ number, status, placedAt, delivery, availableAction, latestRequest }) => (
                      <li key={number} className="border-t border-supportops-border pt-2">
                        <p className="font-medium">{number}</p>
                        <p className="capitalize text-supportops-text-light">
                          {formatStatus(status)} · {formatDate(placedAt)}
                        </p>
                        {delivery && (
                          <>
                            <p>Delivery {formatStatus(delivery.status)}</p>
                            {delivery.trackingNumber && (
                              <p className="break-words">
                                {delivery.carrier && `${delivery.carrier} · `}
                                {delivery.trackingNumber}
                              </p>
                            )}
                            {delivery.deliveredAt ? (
                              <p>Delivered {formatDate(delivery.deliveredAt)}</p>
                            ) : (
                              delivery.estimatedDeliveryAt && (
                                <p>Estimated {formatDate(delivery.estimatedDeliveryAt)}</p>
                              )
                            )}
                          </>
                        )}
                        {latestRequest && (
                          <p className="mt-1 capitalize">
                            {latestRequest.type} request {latestRequest.status}
                          </p>
                        )}
                        {availableAction &&
                          !(
                            latestRequest?.status === "pending" &&
                            latestRequest.type === availableAction
                          ) && (
                            <button
                              type="button"
                              disabled={pending}
                              className="mt-1 text-supportops-primary underline"
                              onClick={() => {
                                setOrderReceipt("");
                                setOrderRequest({ number, type: availableAction });
                              }}
                            >
                              {availableAction === "refund"
                                ? "Request a refund"
                                : "Request cancellation"}
                            </button>
                          )}
                        {orderRequest?.number === number && (
                          <form
                            onSubmit={submitOrderRequest}
                            className="mt-2 space-y-2"
                            key={orderRequest.type}
                          >
                            <label className="block">
                              Reason for {orderRequest.type}
                              <textarea
                                className={`${inputClass} mt-1`}
                                name="reason"
                                rows={2}
                                required
                                maxLength={2000}
                                disabled={pending}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button className={buttonClass} disabled={pending}>
                                Submit request
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => setOrderRequest(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </li>
                    )
                  )}
                </ul>
                {(orderPage > 1 || hasMoreOrders) && (
                  <nav className="mt-3 flex justify-between gap-2 text-sm" aria-label="Order pages">
                    <button
                      type="button"
                      disabled={pending || orderPage === 1 || orders === null}
                      className="disabled:opacity-50"
                      onClick={() => changeOrderPage(orderPage - 1)}
                    >
                      Previous
                    </button>
                    <span>Page {orderPage}</span>
                    <button
                      type="button"
                      disabled={pending || !hasMoreOrders}
                      className="disabled:opacity-50"
                      onClick={() => changeOrderPage(orderPage + 1)}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
