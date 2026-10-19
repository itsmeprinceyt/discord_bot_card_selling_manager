"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import ConfirmDialog from "../../../(components)/ConfirmDialog";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";

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
  traded_for: string | null;
  orders: Order[];
}

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
    if (!search.trim()) return;
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
      toast.error(getAxiosErrorMessage(err, "Failed to refresh card"));
    }
  };

  const handleCancelFirst = () => {
    if (!card || card.orders.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: "Cancel First Position",
      message: `Cancel position #1 buyer for ${card.card_code}?`,
      confirmText: "Cancel First",
      variant: "danger",
      onConfirm: async () => {
        try {
          await axios.patch(
            `/api/dashboard/accounts/${accountId}/orders/${card.orders[0]?.id}`,
            { action: "cancel-first" },
            { withCredentials: true },
          );
          setMsg("Position #1 cancelled.");
          await refresh();
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to cancel"));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRemove = (orderId: string, pos: number) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove from Queue",
      message: `Remove position #${pos} from the queue?`,
      confirmText: "Remove",
      variant: "danger",
      onConfirm: async () => {
        try {
          await axios.patch(
            `/api/dashboard/accounts/${accountId}/orders/${orderId}`,
            { action: "cancel" },
            { withCredentials: true },
          );
          setMsg(`Position #${pos} removed.`);
          await refresh();
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to remove"));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
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
        try {
          await axios.patch(
            `/api/dashboard/accounts/${accountId}/orders/${orderId}`,
            { action: "complete", completed_cards: desc },
            { withCredentials: true },
          );
          setMsg(`Order #${pos} marked as done - ${desc}`);
          await refresh();
        } catch (err) {
          setError(getAxiosErrorMessage(err, "Failed to complete order"));
        } finally {
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
        try {
          await axios.post(
            `/api/dashboard/accounts/${accountId}/cards/mark-traded`,
            {
              card_id: card.id,
              completed_cards: desc,
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
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
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {loading ? "Searching..." : "Search"}
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

        {searched && !card && (
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
                        className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-white cursor-pointer"
                      >
                        Mark Traded
                      </button>
                      <button
                        onClick={() => handleMarkTraded(true)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 cursor-pointer"
                      >
                        Mark Traded + Delete
                      </button>
                      <button
                        onClick={handleCancelFirst}
                        className="rounded-lg border border-red-500/20 bg-neutral-950 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 cursor-pointer"
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
                          className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-300 transition hover:bg-neutral-800 hover:text-white cursor-pointer"
                        >
                          Done
                        </button>
                        <button
                          onClick={() =>
                            handleRemove(order.id, order.queue_position)
                          }
                          className="rounded-lg border border-neutral-800 px-3 py-1 text-xs text-neutral-400 transition hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 cursor-pointer"
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
      />
    </main>
  );
}
