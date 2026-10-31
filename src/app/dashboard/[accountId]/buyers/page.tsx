"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Search,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../(components)/ConfirmDialog";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";
import SkeletonBlock from "../../../(components)/SkeletonBlock";

interface BuyerOrder {
  id: string;
  queue_position: number;
  status: string;
  card: {
    id: string;
    card_code: string;
    price_tier: number;
    currency_type: string;
  };
}

interface Buyer {
  id: string;
  discord_id: string;
  created_at: string;
  orders: BuyerOrder[];
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function BuyerResultSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950/50 p-6">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-6 w-36" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
          <SkeletonBlock className="h-8 w-32 rounded-lg" />
          <SkeletonBlock className="h-8 w-36 rounded-lg" />
          <SkeletonBlock className="h-8 w-48 rounded-lg" />
        </div>
      </div>
      <div className="border-b border-neutral-800 bg-neutral-950/30 px-6 py-3">
        <SkeletonBlock className="mb-1 h-3 w-32" />
        <SkeletonBlock className="h-3 w-2/3" />
      </div>
      <div className="p-6 space-y-8">
        <div>
          <SkeletonBlock className="mb-4 h-4 w-36" />
          <div className="space-y-4">
            <div>
              <SkeletonBlock className="mb-2 h-3 w-20" />
              <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500/30">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-4 w-36" />
              </div>
            </div>
            <div>
              <SkeletonBlock className="mb-2 h-3 w-24" />
              <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500/30">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-4 w-28" />
              </div>
            </div>
            <div className="border-t border-neutral-800 pt-3">
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div>
          <SkeletonBlock className="mb-4 h-4 w-40" />
          <div className="space-y-4">
            <div>
              <SkeletonBlock className="mb-2 h-3 w-20" />
              <div className="space-y-1.5 pl-3 border-l-2 border-amber-500/30">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonBlock className="h-4 w-28" />
              </div>
            </div>
            <div className="border-t border-neutral-800 pt-3">
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BuyersPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [search, setSearch] = useState("");
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [copiedCodes, setCopiedCodes] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [confirmLoading, setConfirmLoading] = useState(false);

  // Inline edit state for the buyer's Discord ID
  const [editingId, setEditingId] = useState(false);
  const [draftId, setDraftId] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const saveSubmittingRef = useRef(false);

  const searchSubmittingRef = useRef(false);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    variant: "default" as "default" | "danger",
    onConfirm: () => {},
  });

  const formatDiscordId = (discord_id: string): string => `<@${discord_id}>`;

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSubmittingRef.current || loading) return;
    if (!search.trim()) return;

    searchSubmittingRef.current = true;
    setLoading(true);
    setMsg("");
    setError("");
    setCopiedCodes(false);
    setCopiedSummary(false);
    setEditingId(false);

    try {
      const { data } = await axios.get(
        `/api/dashboard/accounts/${accountId}/buyers?discord_id=${search.trim()}`,
        { withCredentials: true },
      );
      setBuyer(data.buyer);
    } catch (err: unknown) {
      setBuyer(null);
      if (!axios.isAxiosError(err) || err.response?.status !== 404) {
        toast.error(getAxiosErrorMessage(err, "Failed to search buyer"));
      }
    } finally {
      setSearched(true);
      setLoading(false);
      searchSubmittingRef.current = false;
    }
  };

  const refresh = async () => {
    if (!buyer) return;
    try {
      const { data } = await axios.get(
        `/api/dashboard/accounts/${accountId}/buyers?discord_id=${buyer.discord_id}`,
        { withCredentials: true },
      );
      setBuyer(data.buyer);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Failed to refresh buyer"));
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Inline ID editing + transfer                                    */
  /* ---------------------------------------------------------------- */

  const startEditing = () => {
    if (!buyer) return;
    setDraftId(buyer.discord_id);
    setEditingId(true);
  };

  const cancelEditing = () => {
    setEditingId(false);
    setDraftId("");
  };

  const commitEdit = () => {
    if (!buyer) return;
    const trimmed = draftId.trim();
    if (!trimmed) {
      setError("Discord ID is required");
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setError("Discord ID must be numeric");
      return;
    }
    if (trimmed === buyer.discord_id) {
      setEditingId(false);
      return;
    }

    const orderCount = buyer.orders.length;
    const sourceId = buyer.discord_id;

    setConfirmDialog({
      isOpen: true,
      title: "Transfer Buyer",
      message:
        `Transfer all ${orderCount} order(s) from ${formatDiscordId(sourceId)} ` +
        `to ${formatDiscordId(trimmed)}?\n\n` +
        `If ${formatDiscordId(trimmed)} already has an order for the same card, ` +
        `the ${formatDiscordId(sourceId)} entry for that card will be removed. ` +
        `Otherwise the orders keep their queue position.`,
      confirmText: "Transfer",
      variant: "danger",
      onConfirm: async () => {
        if (saveSubmittingRef.current) return;
        saveSubmittingRef.current = true;
        setConfirmLoading(true);
        setMsg("");
        setError("");

        try {
          const { data } = await axios.patch(
            `/api/dashboard/accounts/${accountId}/buyers/${buyer.id}`,
            { discord_id: trimmed },
            { withCredentials: true },
          );

          const parts: string[] = [];
          if (data.reassigned > 0) parts.push(`${data.reassigned} transferred`);
          if (data.dropped > 0) parts.push(`${data.dropped} dropped`);
          setMsg(`Buyer updated: ${parts.join(", ") || "no orders moved"}.`);

          // Source buyer may have been deleted — switch the view to target.
          setSearch(trimmed);
          setEditingId(false);
          setDraftId("");

          try {
            const refreshRes = await axios.get(
              `/api/dashboard/accounts/${accountId}/buyers?discord_id=${trimmed}`,
              { withCredentials: true },
            );
            setBuyer(refreshRes.data.buyer);
          } catch {
            // Target exists but has no orders — show empty state.
            setBuyer({
              id: data.targetBuyerId,
              discord_id: trimmed,
              created_at: new Date().toISOString(),
              orders: [],
            });
          }
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to transfer buyer"));
          // Keep the edit field open so the user can retry / fix the ID.
        } finally {
          setConfirmLoading(false);
          saveSubmittingRef.current = false;
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Mark active done                                                */
  /* ---------------------------------------------------------------- */

  const handleMarkActiveDone = (deleteFromDiscord: boolean = false) => {
    if (!buyer) return;
    const activeOrders = getActiveOrders();
    if (activeOrders.length === 0) return;

    const message = deleteFromDiscord
      ? `Mark ${activeOrders.length} active (position #1) orders for ${formatDiscordId(buyer.discord_id)} as done AND delete from Discord? Waitlisted orders will NOT be affected.`
      : `Mark ${activeOrders.length} active (position #1) orders for ${formatDiscordId(buyer.discord_id)} as done? Waitlisted orders will NOT be affected.`;

    setConfirmDialog({
      isOpen: true,
      title: deleteFromDiscord ? "Confirm Deletion" : "Confirm Action",
      message,
      confirmText: deleteFromDiscord ? "Mark Done & Delete" : "Mark Done",
      variant: deleteFromDiscord ? "danger" : "default",
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          for (const order of activeOrders) {
            await axios.patch(
              `/api/dashboard/accounts/${accountId}/orders/${order.id}`,
              {
                action: "complete",
                delete_from_discord: deleteFromDiscord,
              },
              { withCredentials: true },
            );
          }

          setMsg(
            `${activeOrders.length} active orders marked as done${
              deleteFromDiscord ? " and deleted from Discord" : ""
            }.`,
          );
          await refresh();
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to mark done"));
        } finally {
          setConfirmLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Derived data                                                    */
  /* ---------------------------------------------------------------- */

  const getActiveOrders = () => {
    if (!buyer) return [];
    return buyer.orders.filter(
      (o) => o.status === "WAITING" && o.queue_position === 1,
    );
  };

  const getWaitlistedOrders = () => {
    if (!buyer) return [];
    return buyer.orders.filter(
      (o) => o.status === "WAITING" && o.queue_position > 1,
    );
  };

  const getActiveCodes = () => getActiveOrders().map((o) => o.card.card_code);

  const getActiveSummary = () => {
    const activeOrders = getActiveOrders();
    const totals: Record<string, number> = {};
    activeOrders.forEach((order) => {
      const currency = order.card.currency_type || "silver";
      if (!totals[currency]) totals[currency] = 0;
      totals[currency] += order.card.price_tier;
    });
    return Object.entries(totals)
      .map(([currency, amount]) => `${amount} ${currency}`)
      .join(", ");
  };

  const getWaitlistedSummary = () => {
    const waitlistedOrders = getWaitlistedOrders();
    const totals: Record<string, number> = {};
    waitlistedOrders.forEach((order) => {
      const currency = order.card.currency_type || "silver";
      if (!totals[currency]) totals[currency] = 0;
      totals[currency] += order.card.price_tier;
    });
    return Object.entries(totals)
      .map(([currency, amount]) => `${amount} ${currency}`)
      .join(", ");
  };

  const copyCodesOnly = () => {
    if (!buyer) return;
    const codes = getActiveCodes();
    if (codes.length === 0) {
      setError("No active (position #1) cards for this buyer");
      return;
    }
    navigator.clipboard.writeText(codes.join(", "));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const copyWithSummary = () => {
    if (!buyer) return;
    const codes = getActiveCodes();
    if (codes.length === 0) {
      setError("No active (position #1) cards for this buyer");
      return;
    }
    const summary = getActiveSummary();
    navigator.clipboard.writeText(`${codes.join(", ")} ( ${summary} )`);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const groupByTier = (orders: BuyerOrder[]) => {
    const grouped = orders.reduce(
      (acc: Record<number, BuyerOrder[]>, order) => {
        const t = order.card.price_tier;
        if (!acc[t]) acc[t] = [];
        acc[t].push(order);
        return acc;
      },
      {},
    );
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((tier) => ({ tier, orders: grouped[tier] }));
  };

  const activeGrouped = groupByTier(getActiveOrders());
  const waitlistedGrouped = groupByTier(getWaitlistedOrders());

  const activeCount = getActiveOrders().length;
  const waitlistedCount = getWaitlistedOrders().length;

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(`/dashboard/${accountId}`)}
            disabled={confirmLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Buyer Lookup
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Search and manage a specific buyer&apos;s queue
            </p>
          </div>
        </div>

        <form onSubmit={doSearch} className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Discord User ID"
              disabled={loading}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="rounded-lg bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer flex items-center justify-center gap-2 min-w-25"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {msg && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {msg}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && !buyer && <BuyerResultSkeleton />}

        {!loading && searched && !buyer && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            No buyer found with ID &quot;{search}&quot;
          </div>
        )}

        {buyer && (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex flex-col gap-4 border-b border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Buyer
                  </div>

                  {editingId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1">
                        <span className="shrink-0 text-base font-bold text-neutral-500 select-none sm:text-lg">
                          &lt;@
                        </span>
                        <input
                          ref={editInputRef}
                          type="text"
                          inputMode="numeric"
                          value={draftId}
                          onChange={(e) =>
                            setDraftId(e.target.value.replace(/[^\d]/g, ""))
                          }
                          onKeyDown={handleEditKeyDown}
                          disabled={confirmLoading}
                          className="min-w-0 flex-1 bg-transparent text-base font-bold text-white outline-none disabled:opacity-60 sm:text-lg"
                        />
                        <span className="shrink-0 text-base font-bold text-neutral-500 select-none sm:text-lg">
                          &gt;
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={commitEdit}
                          disabled={confirmLoading}
                          aria-label="Save"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={confirmLoading}
                          aria-label="Cancel"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditing}
                      disabled={confirmLoading}
                      title="Click to change Discord ID"
                      className="group mt-1 flex max-w-full items-center gap-2 truncate text-base font-bold text-white transition hover:text-neutral-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer sm:text-lg"
                    >
                      <span className="truncate">
                        {formatDiscordId(buyer.discord_id)}
                      </span>
                      <Pencil
                        size={14}
                        className="shrink-0 text-neutral-500 opacity-60 transition group-hover:opacity-100"
                      />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <button
                    onClick={copyCodesOnly}
                    disabled={activeCount === 0 || confirmLoading || editingId}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Copy size={14} />
                    {copiedCodes ? "Copied!" : "Copy Codes"}
                  </button>
                  <button
                    onClick={copyWithSummary}
                    disabled={activeCount === 0 || confirmLoading || editingId}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Copy size={14} />
                    {copiedSummary ? "Copied!" : "Copy + Summary"}
                  </button>
                  <button
                    onClick={() => handleMarkActiveDone(false)}
                    disabled={activeCount === 0 || confirmLoading || editingId}
                    className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Mark Active Done
                  </button>
                  <button
                    onClick={() => handleMarkActiveDone(true)}
                    disabled={activeCount === 0 || confirmLoading || editingId}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Mark Active Done + Delete
                  </button>
                </div>
              </div>
            </div>

            {activeCount > 0 && (
              <div className="border-b border-neutral-800 bg-neutral-950/30 px-6 py-3">
                <div className="mb-1 text-xs font-medium text-neutral-500">
                  Preview (active only):
                </div>
                <div className="wrap-break-word font-mono text-xs text-neutral-400">
                  {getActiveCodes().join(", ")} ( {getActiveSummary()} )
                </div>
              </div>
            )}

            <div className="p-6 space-y-8">
              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <span>▸ Active Cards ({activeCount})</span>
                </div>
                {activeCount === 0 ? (
                  <p className="text-sm text-neutral-500">No active cards</p>
                ) : (
                  <div className="space-y-4">
                    {activeGrouped.map((group) => (
                      <div key={group.tier}>
                        <div className="mb-2 text-xs font-medium text-neutral-500">
                          {group.tier}{" "}
                          {group.orders[0]?.card?.currency_type || "silver"}
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-emerald-500/30">
                          {group.orders.map((order) => (
                            <div key={order.id} className="text-sm">
                              <span className="text-neutral-200">
                                {order.card.card_code}
                              </span>
                              <span className="ml-2 text-[10px] font-medium text-emerald-500">
                                #1
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-neutral-800 pt-3">
                      <span className="text-xs text-neutral-500">
                        Total: {getActiveSummary()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {waitlistedCount > 0 && (
                <div>
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-400">
                    <span>▸ Waitlisted Cards ({waitlistedCount})</span>
                  </div>
                  <div className="space-y-4">
                    {waitlistedGrouped.map((group) => (
                      <div key={group.tier}>
                        <div className="mb-2 text-xs font-medium text-neutral-500">
                          {group.tier}{" "}
                          {group.orders[0]?.card?.currency_type || "silver"}
                        </div>
                        <div className="space-y-1.5 pl-3 border-l-2 border-amber-500/30">
                          {group.orders.map((order) => (
                            <div key={order.id} className="text-sm">
                              <span className="text-neutral-200">
                                {order.card.card_code}
                              </span>
                              <span className="ml-2 text-[10px] font-medium text-amber-500">
                                #{order.queue_position}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-neutral-800 pt-3">
                      <span className="text-xs text-neutral-500">
                        Total: {getWaitlistedSummary()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeCount === 0 && waitlistedCount === 0 && (
                <p className="text-sm text-neutral-500">
                  No active reservations
                </p>
              )}
            </div>
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
        loading={confirmLoading}
      />
    </main>
  );
}
