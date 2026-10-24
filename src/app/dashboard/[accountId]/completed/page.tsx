"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bomb,
  Check,
  Copy,
  Eye,
  EyeOff,
  Search,
  Trash,
  X,
  Info,
} from "lucide-react";
import React from "react";
import axios from "axios";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../(components)/ConfirmDialog";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";
import { formatDateTime } from "../../../../utils/Formator/formatDateTime.util";
import SkeletonBlock from "../../../(components)/SkeletonBlock";

const BOMB_TIMER_SECONDS = 4;
const STORAGE_KEY = "disc_card_mng";

const REFETCH_THRESHOLD = 5;

type StatusFilter = "all" | "WAITING" | "CANCELLED" | "COMPLETED";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "WAITING", label: "Waiting" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

interface StoredFilters {
  status: StatusFilter;
  showDeleted: boolean;
}

const DEFAULT_FILTERS: StoredFilters = {
  status: "all",
  showDeleted: true,
};

interface Order {
  id: string;
  queue_position: number;
  status: "WAITING" | "CANCELLED" | "COMPLETED";
  completed_at: string | null;
  created_at: string;
  deleted: boolean;
  buyer: {
    discord_id: string;
  };
  card: {
    card_code: string;
    price_tier: number;
    currency_type: string;
  };
}

function getOrderDate(order: Order): string {
  return order.completed_at || order.created_at;
}

function groupOrders(orders: Order[]) {
  const groups: { label: string; date: string; orders: Order[] }[] = [];
  const today = new Date().toLocaleDateString("en-US");
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toLocaleDateString("en-US");

  for (const order of orders) {
    const dateStr = getOrderDate(order);
    const orderDate = new Date(dateStr).toLocaleDateString("en-US");
    let label: string;
    if (orderDate === today) label = "Today";
    else if (orderDate === yesterday) label = "Yesterday";
    else
      label = new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    const existingGroup = groups.find((g) => g.date === orderDate);
    if (existingGroup) {
      existingGroup.orders.push(order);
    } else {
      groups.push({ label, date: orderDate, orders: [order] });
    }
  }
  return groups;
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const styles: Record<Order["status"], string> = {
    COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    WAITING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    CANCELLED: "bg-neutral-700/40 text-neutral-400 border-neutral-700",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium ${styles[status] ?? "bg-neutral-800 text-neutral-400 border-neutral-700"}`}
    >
      {status}
    </span>
  );
}

function CopyButton({
  isCopied,
  onCopy,
}: {
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`transition-all duration-200 cursor-pointer ${
        isCopied
          ? "text-emerald-400 scale-110"
          : "text-neutral-600 hover:text-neutral-200"
      }`}
      title={isCopied ? "Copied!" : "Copy card code"}
    >
      {isCopied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function BombButton({
  timer,
  isCopied,
  onArm,
}: {
  timer: number | undefined;
  isCopied: boolean;
  onArm: () => void;
}) {
  const isActive = timer !== undefined;

  return (
    <button
      type="button"
      onClick={onArm}
      className={`relative transition-all duration-200 cursor-pointer ${
        isActive
          ? "text-orange-400 scale-125"
          : isCopied
            ? "text-emerald-400"
            : "text-neutral-600 hover:text-orange-400 hover:scale-110"
      }`}
      title={
        isActive ? `Bomb armed: ${timer}s` : "Arm bomb timer (copies code)"
      }
    >
      <Bomb size={14} />
      {isActive && (
        <span className="absolute -top-2 -right-2 text-[10px] font-bold text-orange-400 bg-neutral-950 rounded-full px-1">
          {timer}
        </span>
      )}
    </button>
  );
}

function readStoredFilters(): StoredFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;

    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as Partial<StoredFilters>;
      const status = STATUS_OPTIONS.some((o) => o.value === parsed.status)
        ? (parsed.status as StatusFilter)
        : DEFAULT_FILTERS.status;
      const showDeleted =
        typeof parsed.showDeleted === "boolean"
          ? parsed.showDeleted
          : DEFAULT_FILTERS.showDeleted;
      return { status, showDeleted };
    }

    if (STATUS_OPTIONS.some((o) => o.value === raw)) {
      return { status: raw as StatusFilter, showDeleted: true };
    }
  } catch {}
  return DEFAULT_FILTERS;
}

function isAbortError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  const code = (err as { code?: string })?.code;
  return code === "ERR_CANCELED" || code === "ERR_ABORTED";
}

function isNotCompletedError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const msg = (err.response?.data as { error?: string } | undefined)?.error;
  return (
    typeof msg === "string" &&
    msg.toLowerCase().includes("only completed orders")
  );
}

function OrdersSkeleton() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-neutral-800/70" />
            <div className="space-y-2">
              <SkeletonBlock className="h-6 w-20" />
              <SkeletonBlock className="h-3 w-44" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <SkeletonBlock className="h-3 w-12" />
            <SkeletonBlock className="h-9.5 w-28 rounded-lg" />
            <SkeletonBlock className="h-9.5 w-32 rounded-lg" />
          </div>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <SkeletonBlock className="h-4.5 w-4.5 shrink-0 rounded" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 mb-6">
          <SkeletonBlock className="h-10.5 flex-1 rounded-lg" />
          <SkeletonBlock className="h-10.5 w-24 rounded-lg" />
        </div>

        <SkeletonBlock className="mb-4 h-3 w-24" />

        <div className="hidden sm:block overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-6">
              <SkeletonBlock className="h-3 w-10" />
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="ml-auto h-3 w-12" />
            </div>
          </div>

          <div className="bg-neutral-950/50 px-4 py-2">
            <SkeletonBlock className="h-3 w-16" />
          </div>

          <div className="divide-y divide-neutral-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-4 py-3">
                <SkeletonBlock className="h-7 w-7 shrink-0 rounded" />
                <SkeletonBlock className="h-4.5 w-20 shrink-0 rounded" />
                <SkeletonBlock className="h-3.5 w-32 shrink-0" />
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-3.5 w-20" />
                  <SkeletonBlock className="h-3.5 w-3.5 rounded" />
                  <SkeletonBlock className="h-3.5 w-3.5 rounded" />
                </div>
                <SkeletonBlock className="h-3.5 w-16 shrink-0" />
                <SkeletonBlock className="h-3 w-20 shrink-0" />
                <SkeletonBlock className="ml-auto h-7 w-16 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <div className="sm:hidden space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="flex items-center justify-between px-1 py-2 border-b border-neutral-800 mb-2">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                    <SkeletonBlock className="h-7 w-7 shrink-0 rounded" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SkeletonBlock className="h-3.5 w-20" />
                        <SkeletonBlock className="h-3.5 w-3.5 rounded" />
                        <SkeletonBlock className="h-3.5 w-3.5 rounded" />
                        <SkeletonBlock className="h-4.5 w-16 rounded" />
                      </div>
                      <SkeletonBlock className="h-3 w-16" />
                    </div>
                  </div>
                  <SkeletonBlock className="h-7 w-14 shrink-0 rounded-lg" />
                </div>
                <div className="ml-9 space-y-1.5">
                  <SkeletonBlock className="h-3 w-32" />
                  <SkeletonBlock className="h-3 w-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function CompletedPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [hydrated, setHydrated] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showDeleted, setShowDeleted] = useState(true);

  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bombTimers, setBombTimers] = useState<Map<string, number>>(new Map());
  const timerIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const [undoLoading, setUndoLoading] = useState(false);

  const showDeletedRef = useRef(showDeleted);
  const handleToggleDeletedRef = useRef<(id: string) => void>(() => {});
  const ordersRef = useRef<Order[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    showDeletedRef.current = showDeleted;
  }, [showDeleted]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    variant: "default" as "default" | "danger",
    onConfirm: () => {},
  });

  useEffect(() => {
    const load = () => {
      const stored = readStoredFilters();
      setStatusFilter(stored.status);
      setShowDeleted(stored.showDeleted);
      setHydrated(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ status: statusFilter, showDeleted }),
      );
    } catch {}
  }, [statusFilter, showDeleted, hydrated]);

  const clearBombTimer = useCallback((orderId: string) => {
    const interval = timerIntervalsRef.current.get(orderId);
    if (interval) {
      clearInterval(interval);
      timerIntervalsRef.current.delete(orderId);
    }
    setBombTimers((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Map(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const loadOrders = useCallback(
    async (overridePage?: number) => {
      const targetPage = overridePage ?? page;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const myRequestId = ++requestIdRef.current;

      setLoading(true);
      try {
        const { data } = await axios.get(
          `/api/dashboard/accounts/${accountId}/completed?page=${targetPage}&search=${encodeURIComponent(
            search,
          )}&status=${statusFilter}&showDeleted=${showDeleted}`,
          { withCredentials: true, signal: controller.signal },
        );

        if (myRequestId !== requestIdRef.current) return null;

        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        if (data.page && data.page !== targetPage) {
          setPage(data.page);
        }
        return data as {
          ok: boolean;
          orders: Order[];
          total: number;
          pages: number;
          page: number;
        };
      } catch (err) {
        if (isAbortError(err)) return null;
        if (myRequestId !== requestIdRef.current) return null;

        toast.error(getAxiosErrorMessage(err, "Failed to fetch orders"));
        return null;
      } finally {
        if (myRequestId === requestIdRef.current) {
          setLoading(false);
          setFirstLoadDone(true);
        }
      }
    },
    [accountId, page, search, statusFilter, showDeleted],
  );

  useEffect(() => {
    const load = () => {
      if (!hydrated) return;
      loadOrders();
    };
    load();
  }, [hydrated, loadOrders]);

  useEffect(() => {
    const intervals = timerIntervalsRef.current;
    return () => {
      abortRef.current?.abort();
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleStatusChange = (next: StatusFilter) => {
    setStatusFilter(next);
    setPage(1);
  };

  const handleToggleShowDeleted = () => {
    setShowDeleted((prev) => !prev);
    setPage(1);
  };

  const handleUndo = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Undo Completed Order",
      message:
        "Undo this completed order? It will be re-added to the card queue.",
      confirmText: "Undo Order",
      variant: "default",
      onConfirm: async () => {
        setUndoLoading(true);
        try {
          await axios.patch(
            `/api/dashboard/accounts/${accountId}/orders/${orderId}/undo`,
            {},
            { withCredentials: true },
          );
          setMsg("Order restored to queue.");
          await loadOrders();
        } catch (err) {
          toast.error(getAxiosErrorMessage(err, "Failed to undo order"));
        } finally {
          setUndoLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleToggleDeleted = useCallback(
    async (orderId: string) => {
      const currentOrder = ordersRef.current.find((o) => o.id === orderId);

      if (!currentOrder) {
        clearBombTimer(orderId);
        return;
      }

      if (currentOrder.status !== "COMPLETED") {
        clearBombTimer(orderId);
        toast.error("This order is no longer completed. Refreshing list...");
        await loadOrders();
        return;
      }

      setTogglingIds((prev) => new Set(prev).add(orderId));
      try {
        await axios.patch(
          `/api/dashboard/accounts/${accountId}/orders/${orderId}/toggle-deleted`,
          {},
          { withCredentials: true },
        );

        clearBombTimer(orderId);

        if (showDeletedRef.current) {
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === orderId
                ? { ...order, deleted: !order.deleted }
                : order,
            ),
          );
          return;
        }

        const remainingVisible = ordersRef.current
          .filter((o) => o.id !== orderId)
          .filter((o) => !o.deleted).length;

        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setTotal((prev) => Math.max(0, prev - 1));

        if (remainingVisible <= REFETCH_THRESHOLD) {
          await loadOrders();
        }
      } catch (err) {
        clearBombTimer(orderId);

        if (isNotCompletedError(err)) {
          toast.error("This order is no longer completed. Refreshing list...");
          await loadOrders();
          return;
        }

        toast.error(
          getAxiosErrorMessage(err, "Failed to toggle deleted status"),
        );
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [accountId, clearBombTimer, loadOrders],
  );

  useEffect(() => {
    handleToggleDeletedRef.current = handleToggleDeleted;
  }, [handleToggleDeleted]);

  const flashCopied = useCallback((key: string) => {
    setCopiedId(key);
    setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 2000);
  }, []);

  const startBombTimer = async (
    orderId: string,
    cardCode: string,
    copyKey: string,
  ) => {
    try {
      await navigator.clipboard.writeText(cardCode);
      flashCopied(copyKey);
    } catch {}

    clearBombTimer(orderId);
    let secondsLeft = BOMB_TIMER_SECONDS;
    setBombTimers((prev) => new Map(prev).set(orderId, secondsLeft));

    const interval = setInterval(() => {
      const stillExists = ordersRef.current.some((o) => o.id === orderId);
      if (!stillExists) {
        clearInterval(interval);
        timerIntervalsRef.current.delete(orderId);
        setBombTimers((prev) => {
          const next = new Map(prev);
          next.delete(orderId);
          return next;
        });
        return;
      }

      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        timerIntervalsRef.current.delete(orderId);
        setBombTimers((prev) => {
          const next = new Map(prev);
          next.delete(orderId);
          return next;
        });
        handleToggleDeletedRef.current(orderId);
      } else {
        setBombTimers((prev) => new Map(prev).set(orderId, secondsLeft));
      }
    }, 1000);

    timerIntervalsRef.current.set(orderId, interval);
  };

  const copyToClipboard = async (text: string, copyKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(copyKey);
    } catch {}
  };

  const copyAllCodesInGroup = async (groupOrders: Order[]) => {
    const codes = groupOrders.map((o) => o.card.card_code).join("\n");
    try {
      await navigator.clipboard.writeText(codes);
      flashCopied(`group-${groupOrders[0]?.id}`);
    } catch {}
  };

  const groupedOrders = groupOrders(orders);

  if (!hydrated) return <OrdersSkeleton />;
  if (loading && orders.length === 0 && !firstLoadDone) {
    return <OrdersSkeleton />;
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/dashboard/${accountId}`)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Review and manage all orders
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <label
              htmlFor="status-filter"
              className="text-sm font-medium text-neutral-400"
            >
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) =>
                handleStatusChange(e.target.value as StatusFilter)
              }
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-neutral-600 cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleToggleShowDeleted}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm transition cursor-pointer ${
                showDeleted
                  ? "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              }`}
              title={!showDeleted ? "Hide deleted orders" : "Show all orders"}
            >
              {showDeleted ? <Eye size={16} /> : <EyeOff size={16} />}
              <span className="hidden sm:inline">
                {!showDeleted ? "Show All" : "Hide Deleted"}
              </span>
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {msg}
          </div>
        )}

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
          <Info size={18} className="shrink-0 mt-0.5" />
          <p>
            <strong>Notice:</strong> All completed orders older than{" "}
            <strong>6 months</strong> are automatically deleted by the system to
            keep the database clean.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 sm:gap-3 mb-6">
          <div className="relative flex-1 min-w-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 hidden sm:block"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Discord ID or card code"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-4 pr-4 sm:pl-10 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-neutral-100 px-4 sm:px-6 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white shrink-0 cursor-pointer"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              className="rounded-lg border border-neutral-800 px-3 py-2.5 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 shrink-0 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </form>

        <div className="text-xs text-neutral-500 mb-4">
          {total} {total === 1 ? "order" : "orders"}
          {statusFilter !== "all" && (
            <span className="ml-2 text-amber-400/80">
              (filtered: {statusFilter.toLowerCase()})
            </span>
          )}
        </div>

        {groupedOrders.length === 0 ? (
          <p className="text-sm text-neutral-500 py-8 text-center">
            No orders found.
          </p>
        ) : (
          <>
            <div
              className="
                hidden sm:block
                overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900
              "
            >
              <table className="w-full text-sm min-w-200">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs text-neutral-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left w-12">Done</th>
                    <th className="px-4 py-3 text-left w-24">Status</th>
                    <th className="px-4 py-3 text-left">Buyer</th>
                    <th className="px-4 py-3 text-left">Card</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {groupedOrders.map((group) => (
                    <React.Fragment key={`fragment-${group.date}`}>
                      <tr className="bg-neutral-950/50">
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-xs text-neutral-400 font-medium"
                        >
                          <div className="flex items-center justify-between">
                            <span>{group.label}</span>
                            <button
                              onClick={() => copyAllCodesInGroup(group.orders)}
                              className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer"
                            >
                              {copiedId === `group-${group.orders[0]?.id}` ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span className="text-xs">
                                {copiedId === `group-${group.orders[0]?.id}`
                                  ? "Copied!"
                                  : `Copy all (${group.orders.length})`}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {group.orders.map((order) => {
                        const canToggleDeleted = order.status === "COMPLETED";
                        const copyKey = `desktop-${order.id}`;
                        return (
                          <tr
                            key={order.id}
                            className={`hover:bg-neutral-800/50 transition-colors ${order.deleted ? "bg-emerald-950/20" : ""}`}
                          >
                            <td className="px-4 py-3">
                              {canToggleDeleted ? (
                                <button
                                  onClick={() => handleToggleDeleted(order.id)}
                                  disabled={togglingIds.has(order.id)}
                                  className={`p-1.5 rounded cursor-pointer transition-all disabled:opacity-50 ${
                                    order.deleted
                                      ? "bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60"
                                      : "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                                  }`}
                                  title={
                                    order.deleted
                                      ? "Restore order"
                                      : "Mark as deleted"
                                  }
                                >
                                  {order.deleted ? (
                                    <Check size={16} />
                                  ) : (
                                    <Trash size={16} />
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-700">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={order.status} />
                            </td>
                            <td className="px-4 py-3 text-neutral-300 text-xs sm:text-sm whitespace-nowrap">
                              &lt;@{order.buyer.discord_id}&gt;
                            </td>
                            <td className="px-4 py-3 text-neutral-100 text-xs sm:text-sm whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>{order.card.card_code}</span>
                                <CopyButton
                                  isCopied={copiedId === copyKey}
                                  onCopy={() =>
                                    copyToClipboard(
                                      order.card.card_code,
                                      copyKey,
                                    )
                                  }
                                />
                                <BombButton
                                  timer={bombTimers.get(order.id)}
                                  isCopied={copiedId === copyKey}
                                  onArm={() =>
                                    startBombTimer(
                                      order.id,
                                      order.card.card_code,
                                      copyKey,
                                    )
                                  }
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-neutral-400 text-xs sm:text-sm whitespace-nowrap">
                              {order.card.price_tier} {order.card.currency_type}
                            </td>
                            <td className="px-4 py-3 text-neutral-600 text-xs hidden md:table-cell whitespace-nowrap">
                              {formatDateTime(getOrderDate(order))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {order.status === "COMPLETED" ? (
                                <button
                                  onClick={() => handleUndo(order.id)}
                                  disabled={undoLoading}
                                  className="rounded-lg border border-neutral-800 px-2 sm:px-3 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Undo
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-700">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-4">
              {groupedOrders.map((group) => (
                <div key={`mobile-group-${group.date}`}>
                  <div className="flex items-center justify-between px-1 py-2 border-b border-neutral-800 mb-2">
                    <span className="text-xs text-neutral-500 font-medium">
                      {group.label}
                    </span>
                    <button
                      onClick={() => copyAllCodesInGroup(group.orders)}
                      className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200 text-xs cursor-pointer"
                    >
                      {copiedId === `group-${group.orders[0]?.id}` ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {copiedId === `group-${group.orders[0]?.id}`
                        ? "Copied!"
                        : `Copy all (${group.orders.length})`}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {group.orders.map((order) => {
                      const canToggleDeleted = order.status === "COMPLETED";
                      const copyKey = `mobile-${order.id}`;
                      return (
                        <div
                          key={order.id}
                          className={`rounded-xl border p-4 transition-colors ${order.deleted ? "border-emerald-900/50 bg-emerald-950/20" : "border-neutral-800 bg-neutral-900"}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                              {canToggleDeleted ? (
                                <button
                                  onClick={() => handleToggleDeleted(order.id)}
                                  disabled={togglingIds.has(order.id)}
                                  className={`p-1.5 rounded cursor-pointer transition-all shrink-0 disabled:opacity-50 ${
                                    order.deleted
                                      ? "bg-emerald-900/40 text-emerald-400"
                                      : "bg-red-900/30 text-red-400"
                                  }`}
                                  title={
                                    order.deleted
                                      ? "Restore order"
                                      : "Mark as deleted"
                                  }
                                >
                                  {order.deleted ? (
                                    <Check size={16} />
                                  ) : (
                                    <Trash size={16} />
                                  )}
                                </button>
                              ) : (
                                <span className="p-1.5 shrink-0 text-xs text-neutral-700">
                                  —
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="text-sm text-neutral-100 font-medium truncate">
                                    {order.card.card_code}
                                  </div>
                                  <CopyButton
                                    isCopied={copiedId === copyKey}
                                    onCopy={() =>
                                      copyToClipboard(
                                        order.card.card_code,
                                        copyKey,
                                      )
                                    }
                                  />
                                  <BombButton
                                    timer={bombTimers.get(order.id)}
                                    isCopied={copiedId === copyKey}
                                    onArm={() =>
                                      startBombTimer(
                                        order.id,
                                        order.card.card_code,
                                        copyKey,
                                      )
                                    }
                                  />
                                  <StatusBadge status={order.status} />
                                </div>
                                <div className="text-xs text-neutral-400 mt-0.5">
                                  {order.card.price_tier}{" "}
                                  {order.card.currency_type}
                                </div>
                              </div>
                            </div>
                            {order.status === "COMPLETED" && (
                              <button
                                onClick={() => handleUndo(order.id)}
                                disabled={undoLoading}
                                className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 space-y-1 ml-9">
                            <div className="truncate">
                              Buyer:{" "}
                              <span className="text-neutral-300">
                                &lt;@{order.buyer.discord_id}&gt;
                              </span>
                            </div>
                            <div>
                              {order.status === "COMPLETED"
                                ? "Completed: "
                                : "Created: "}
                              <span className="text-neutral-400">
                                {formatDateTime(getOrderDate(order))}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40 hover:bg-neutral-800 cursor-pointer"
            >
              Prev
            </button>
            <span className="text-sm text-neutral-500">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pages}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-40 hover:bg-neutral-800 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        loading={undoLoading}
      />
    </main>
  );
}
