"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../(components)/ConfirmDialog";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";
import SkeletonBlock from "../../../(components)/SkeletonBlock";

interface Order {
  id: string;
  queue_position: number;
  buyer: {
    discord_id: string;
  };
}

interface Card {
  id: string;
  card_code: string;
  price_tier: number;
  currency_type: string;
  status: "PENDING" | "TRADED" | "CANCELLED";
  orders: Order[];
}

interface CancelActionResponse {
  ok: boolean;
  card_deleted?: boolean;
  card_code?: string;
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function CardResultSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      {/* Header */}
      <div className="border-b border-neutral-800 p-6 bg-neutral-950/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-32" />
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-3.5 w-16" />
              <SkeletonBlock className="h-2.5 w-1" />
              <SkeletonBlock className="h-3.5 w-16" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-8 w-28 rounded-lg" />
            <SkeletonBlock className="h-8 w-40 rounded-lg" />
            <SkeletonBlock className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Queue section */}
      <div className="p-6">
        <SkeletonBlock className="mb-4 h-3 w-32" />

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0"
            >
              {/* Left: position + discord id + badge */}
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-3 w-5" />
                <SkeletonBlock className="h-3.5 w-28" />
                <SkeletonBlock className="h-4.5 w-20 rounded-full" />
              </div>
              {/* Right: Done + Remove buttons */}
              <div className="flex gap-2">
                <SkeletonBlock className="h-7 w-16 rounded-lg" />
                <SkeletonBlock className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CardsPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [search, setSearch] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Loading state for the confirm dialog's async action.
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

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Synchronous guard ────────────────────────────────────────────────
    if (searchSubmittingRef.current || loading) return;
    if (!search.trim()) return;

    searchSubmittingRef.current = true;
    setLoading(true);
    setMsg("");
    setError("");

    try {
      const { data } = await axios.get(
        `/api/dashboard/accounts/${accountId}/cards?card_code=${search.trim()}`,
        { withCredentials: true },
      );
      setCard(data.card);
    } catch (err) {
      setCard(null);
      if (!axios.isAxiosError(err) || err.response?.status !== 404) {
        toast.error(getAxiosErrorMessage(err, "Failed to search card"));
      }
    } finally {
      setSearched(true);
      setLoading(false);
      searchSubmittingRef.current = false;
    }
  };

  const refresh = async () => {
    if (!card) return;
    try {
      const { data } = await axios.get(
        `/api/dashboard/accounts/${accountId}/cards?card_code=${card.card_code}`,
        { withCredentials: true },
      );
      setCard(data.card);
    } catch (err) {
      // If the card vanished (e.g. another tab cancelled the last order),
      // treat it as a clean deletion rather than showing a scary error.
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setCard(null);
        setSearched(false);
        setSearch("");
      } else {
        toast.error(getAxiosErrorMessage(err, "Failed to refresh card"));
      }
    }
  };

  /**
   * Shared handler for both cancel-first and per-row remove.
   *   - Refuses if the card has no waiting orders.
   *   - Warns when this is the last waiting order (card will be deleted).
   *   - After the API call, reacts to `card_deleted` to avoid the
   *     404-on-refresh problem: clears card state + search input instead.
   */
  const performCancel = (
    orderId: string,
    position: number,
    isFirst: boolean,
  ) => {
    if (!card) return;
    if (card.orders.length === 0) return;

    const isLastOrder = card.orders.length === 1;

    const baseMsg = isFirst
      ? `Cancel position #1 buyer for ${card.card_code}?`
      : `Remove position #${position} from the queue?`;

    const message = isLastOrder
      ? `${baseMsg} This is the last buyer — removing them will permanently delete the card ${card.card_code}.`
      : baseMsg;

    setConfirmDialog({
      isOpen: true,
      title: isFirst ? "Cancel First Position" : "Remove from Queue",
      message,
      confirmText: isFirst ? "Cancel First" : "Remove",
      variant: "danger",
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          const { data } = await axios.patch<CancelActionResponse>(
            `/api/dashboard/accounts/${accountId}/orders/${orderId}`,
            { action: isFirst ? "cancel-first" : "cancel" },
            { withCredentials: true },
          );

          if (data?.card_deleted) {
            // Card was destroyed — don't try to refresh (would 404)
            setMsg(
              isFirst
                ? `Position #1 cancelled. Card ${data.card_code ?? card.card_code} deleted permanently — no remaining buyers.`
                : `Position #${position} removed. Card ${data.card_code ?? card.card_code} deleted permanently — no remaining buyers.`,
            );
            setCard(null);
            setSearched(false);
            setSearch("");
            setError("");
          } else {
            setMsg(
              isFirst
                ? "Position #1 cancelled."
                : `Position #${position} removed.`,
            );
            await refresh();
          }
        } catch (err) {
          setError(
            getAxiosErrorMessage(
              err,
              isFirst ? "Failed to cancel" : "Failed to remove",
            ),
          );
        } finally {
          setConfirmLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleCancelFirst = () => {
    if (!card || card.orders.length === 0) return;
    const first = card.orders[0];
    performCancel(first.id, first.queue_position, true);
  };

  const handleRemove = (orderId: string, pos: number) => {
    performCancel(orderId, pos, false);
  };

  const handleMarkDone = (
    orderId: string,
    pos: number,
    discordId: string,
    cardCode: string,
    priceTier: number,
    currencyType: string,
  ) => {
    const desc = `${cardCode} (${priceTier} ${currencyType})`;
    setConfirmDialog({
      isOpen: true,
      title: "Mark as Done",
      message: `Mark ${desc} as done for <@${discordId}>?`,
      confirmText: "Mark Done",
      variant: "default",
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await axios.patch(
            `/api/dashboard/accounts/${accountId}/orders/${orderId}`,
            { action: "complete" },
            { withCredentials: true },
          );
          setMsg(`Order #${pos} marked as done - ${desc}`);
          await refresh();
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to complete order"));
        } finally {
          setConfirmLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleMarkTraded = (deleteFromDiscord: boolean) => {
    if (!card) return;
    const desc = `${card.card_code} (${card.price_tier} ${card.currency_type || "silver"})`;

    setConfirmDialog({
      isOpen: true,
      title: deleteFromDiscord ? "Mark as Traded & Delete" : "Mark as Traded",
      message: deleteFromDiscord
        ? `Mark ${desc} as TRADED and delete from Discord?`
        : `Mark ${desc} as TRADED?`,
      confirmText: deleteFromDiscord ? "Mark Traded & Delete" : "Mark Traded",
      variant: deleteFromDiscord ? "danger" : "default",
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await axios.post(
            `/api/dashboard/accounts/${accountId}/cards/mark-trade`,
            {
              card_id: card.id,
              delete_from_discord: deleteFromDiscord,
            },
            { withCredentials: true },
          );
          setMsg(
            `${desc} marked as TRADED${deleteFromDiscord ? " and deleted from Discord" : ""}.`,
          );
          await refresh();
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to mark traded"));
        } finally {
          setConfirmLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

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
              Card Management
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Search and manage a specific card
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
              placeholder="Search card code (e.g. ABC123)"
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

        {/* Skeleton while a search is in flight (no card yet to keep visible) */}
        {loading && !card && <CardResultSkeleton />}

        {!loading && searched && !card && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            No card found with code &quot;{search}&quot;
          </div>
        )}

        {card && (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 p-6 bg-neutral-950/50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {card.card_code}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
                    <span>
                      {card.price_tier} {card.currency_type || "silver"}
                    </span>
                    <span>•</span>
                    <span
                      className={`font-medium ${
                        card.status === "PENDING"
                          ? "text-amber-400"
                          : card.status === "TRADED"
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {card.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {card.status === "PENDING" && card.orders.length > 0 && (
                    <>
                      <button
                        onClick={() => handleMarkTraded(false)}
                        disabled={confirmLoading}
                        className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Mark Traded
                      </button>
                      <button
                        onClick={() => handleMarkTraded(true)}
                        disabled={confirmLoading}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Mark Traded + Delete
                      </button>
                      <button
                        onClick={handleCancelFirst}
                        disabled={confirmLoading}
                        className="rounded-lg border border-red-500/20 bg-neutral-950 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Cancel First
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Queue ({card.orders.length} waiting)
              </div>
              {card.orders.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No active orders in queue
                </p>
              ) : (
                <div className="space-y-3">
                  {card.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between py-3 border-b border-neutral-800 last:border-0"
                    >
                      <div className="text-sm">
                        <span className="text-neutral-600 mr-2">
                          #{order.queue_position}
                        </span>
                        <span className="text-neutral-200">
                          &lt;@{order.buyer.discord_id}&gt;
                        </span>
                        {order.queue_position === 1 ? (
                          <span className="ml-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            WAITLISTED
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleMarkDone(
                              order.id,
                              order.queue_position,
                              order.buyer.discord_id,
                              card.card_code,
                              card.price_tier,
                              card.currency_type || "silver",
                            )
                          }
                          disabled={confirmLoading}
                          className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Done
                        </button>
                        <button
                          onClick={() =>
                            handleRemove(order.id, order.queue_position)
                          }
                          disabled={confirmLoading}
                          className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
