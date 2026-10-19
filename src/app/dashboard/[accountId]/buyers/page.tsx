"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Search, Loader2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../(components)/ConfirmDialog";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";

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

  // Loading state for the confirm dialog's async action (mark-active-done).
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Synchronous double-submit guard for the search form.
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

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Synchronous guard ────────────────────────────────────────────────
    if (searchSubmittingRef.current || loading) return;
    if (!search.trim()) return;

    searchSubmittingRef.current = true;
    setLoading(true);
    setMsg("");
    setError("");
    setCopiedCodes(false);
    setCopiedSummary(false);

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
        // ConfirmDialog itself blocks double-clicks via its internal ref.
        // We track `confirmLoading` here so the dialog shows "Working…"
        // and the underlying page buttons stay disabled until the batch
        // of API calls finishes.
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
            `${activeOrders.length} active orders marked as done${deleteFromDiscord ? " and deleted from Discord" : ""}.`,
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

        {searched && !buyer && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            No buyer found with ID &quot;{search}&quot;
          </div>
        )}

        {buyer && (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950/50 p-6">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Buyer
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {formatDiscordId(buyer.discord_id)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyCodesOnly}
                  disabled={activeCount === 0 || confirmLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Copy size={14} />
                  {copiedCodes ? "Copied!" : "Copy Codes"}
                </button>
                <button
                  onClick={copyWithSummary}
                  disabled={activeCount === 0 || confirmLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Copy size={14} />
                  {copiedSummary ? "Copied!" : "Copy + Summary"}
                </button>
                <button
                  onClick={() => handleMarkActiveDone(false)}
                  disabled={activeCount === 0 || confirmLoading}
                  className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Mark Active Done
                </button>
                <button
                  onClick={() => handleMarkActiveDone(true)}
                  disabled={activeCount === 0 || confirmLoading}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Mark Active Done + Delete
                </button>
              </div>
            </div>

            {activeCount > 0 && (
              <div className="border-b border-neutral-800 bg-neutral-950/30 px-6 py-3">
                <div className="mb-1 text-xs font-medium text-neutral-500">
                  Preview (active only):
                </div>
                <div className="font-mono text-xs text-neutral-400">
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
