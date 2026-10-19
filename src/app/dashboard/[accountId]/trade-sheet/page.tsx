"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, X } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import CustomLoader from "../../../(components)/CustomLoader";
import ConfirmDialog from "../../../(components)/ConfirmDialog";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";

interface Tier {
  price_tier: number;
  currency_type: string;
  card_codes: string[];
  order_ids: string[];
}

interface Buyer {
  discord_id: string;
  cards: Tier[];
}

export default function TradeSheetPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [byBuyer, setByBuyer] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copyFormat, setCopyFormat] = useState<"codes" | "summary" | "ping">(
    "codes",
  );
  const [copiedBuyer, setCopiedBuyer] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [msg, setMsg] = useState("");

  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({});
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

  // Loading state for the confirm dialog's async action.
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    variant: "default" as "default" | "danger",
    onConfirm: () => {},
  });

  const fetchData = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `/api/dashboard/accounts/${accountId}/trade-sheet`,
        { withCredentials: true },
      );

      setByBuyer(data.byBuyer || []);

      const totals: Record<string, number> = {};
      (data.byBuyer || []).forEach((buyer: Buyer) => {
        buyer.cards.forEach((tier: Tier) => {
          const currency = tier.currency_type || "silver";
          if (!totals[currency]) totals[currency] = 0;
          totals[currency] += tier.price_tier * tier.card_codes.length;
        });
      });
      setGrandTotals(totals);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Failed to fetch trade sheet"));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      const load = () => {
        fetchData();
      };
      load();
    }
  }, [accountId, fetchData]);

  const toggleCheck = (orderId: string) => {
    if (confirmLoading) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleMarkDone = (deleteFromDiscord: boolean) => {
    if (checked.size === 0 || confirmLoading) return;

    setConfirmDialog({
      isOpen: true,
      title: deleteFromDiscord ? "Mark Done & Delete" : "Mark Orders as Done",
      message: `Mark ${checked.size} checked orders as done? ${deleteFromDiscord ? "They will be deleted from Discord. " : ""}All other waitlisted orders for these cards will be cancelled.`,
      confirmText: "Confirm",
      variant: deleteFromDiscord ? "danger" : "default",
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await axios.post(
            `/api/dashboard/accounts/${accountId}/trade-sheet/mark-done`,
            {
              order_ids: Array.from(checked),
              delete_from_discord: deleteFromDiscord,
            },
            { withCredentials: true },
          );
          setChecked(new Set());
          setMsg(`Orders marked as done successfully.`);
          // Await so the UI stays in "loading" until data is fresh —
          // avoids a brief flash of stale rows right before the dialog closes.
          await fetchData();
        } catch (err) {
          toast.error(getAxiosErrorMessage(err, "Failed to mark done"));
        } finally {
          setConfirmLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleRemoveOrder = (
    orderId: string,
    cardCode: string,
    buyerId: string,
  ) => {
    if (confirmLoading) return;

    setConfirmDialog({
      isOpen: true,
      title: "Remove Order",
      message: `Remove ${cardCode} from <@${buyerId}>? This will promote the next buyer.`,
      confirmText: "Remove",
      variant: "danger",
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await axios.patch(
            `/api/dashboard/accounts/${accountId}/orders/${orderId}`,
            { action: "cancel" },
            { withCredentials: true },
          );
          setMsg(`${cardCode} removed.`);
          await fetchData();
        } catch (err) {
          toast.error(getAxiosErrorMessage(err, "Failed to remove order"));
        } finally {
          setConfirmLoading(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const formatDiscordId = (discord_id: string) => `<@${discord_id}>`;

  const getBuyerCards = (buyer: Buyer, filterCurrency?: string) => {
    const filter = filterCurrency || currencyFilter;
    const allCards: string[] = [];
    buyer.cards.forEach((tier) => {
      const currency = tier.currency_type || "silver";
      if (filter === "all" || currency === filter) {
        allCards.push(...tier.card_codes);
      }
    });
    return allCards;
  };

  const getBuyerSummary = (buyer: Buyer, filterCurrency?: string) => {
    const filter = filterCurrency || currencyFilter;
    const totals: Record<string, number> = {};
    buyer.cards.forEach((tier) => {
      const currency = tier.currency_type || "silver";
      if (filter === "all" || currency === filter) {
        if (!totals[currency]) totals[currency] = 0;
        totals[currency] += tier.price_tier * tier.card_codes.length;
      }
    });

    return Object.entries(totals)
      .map(([currency, amount]) => `${amount} ${currency}`)
      .join(", ");
  };

  const getBuyerFormattedText = (buyer: Buyer) => {
    const codes = getBuyerCards(buyer).join(", ");
    if (copyFormat === "codes")
      return `${formatDiscordId(buyer.discord_id)} ${codes}`;
    if (copyFormat === "summary")
      return `${formatDiscordId(buyer.discord_id)} ${codes} ( ${getBuyerSummary(buyer)} )`;
    return formatDiscordId(buyer.discord_id);
  };

  const copyBuyerInfo = (buyer: Buyer) => {
    navigator.clipboard.writeText(getBuyerFormattedText(buyer));
    setCopiedBuyer(buyer.discord_id);
    setTimeout(() => setCopiedBuyer(null), 2000);
  };

  const copyAllBuyers = () => {
    const filteredBuyers = getFilteredBuyers();
    const text =
      copyFormat === "ping"
        ? filteredBuyers.map((b) => formatDiscordId(b.discord_id)).join(" ")
        : filteredBuyers.map((b) => getBuyerFormattedText(b)).join("\n");

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const getFilteredBuyers = () => {
    if (currencyFilter === "all") return byBuyer;
    return byBuyer.filter((buyer) =>
      buyer.cards.some((tier) => {
        const currency = tier.currency_type || "silver";
        return currency === currencyFilter && tier.card_codes.length > 0;
      }),
    );
  };

  const totalActiveBuyers = byBuyer.length;
  const totalCards = byBuyer.reduce(
    (sum, buyer) => sum + getBuyerCards(buyer).length,
    0,
  );
  const availableCurrencies = Object.keys(grandTotals).filter(
    (c) => grandTotals[c] > 0,
  );

  if (loading) return <CustomLoader />;

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/dashboard/${accountId}`)}
              disabled={confirmLoading}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Trade Sheet
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Manage and copy active orders
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={copyAllBuyers}
              disabled={confirmLoading}
              className="flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Copy size={16} />
              {copiedAll ? "Copied All!" : "Copy All"}
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-white">
              {totalActiveBuyers}
            </div>
            <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">
              Buyers
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-white">{totalCards}</div>
            <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">
              Cards
            </div>
          </div>
          {Object.entries(grandTotals)
            .filter(([, amt]) => amt > 0)
            .map(([currency, amount]) => (
              <div
                key={currency}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="text-2xl font-bold text-white">
                  {amount.toLocaleString()}
                </div>
                <div className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">
                  {currency}
                </div>
              </div>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm font-medium text-neutral-400">
            Copy format:
          </span>
          {(["codes", "summary", "ping"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setCopyFormat(fmt)}
              disabled={confirmLoading}
              className={`px-3 py-1.5 text-xs rounded-lg border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                copyFormat === fmt
                  ? "border-neutral-600 bg-neutral-800 text-white"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
              }`}
            >
              {fmt === "codes"
                ? "Card Codes"
                : fmt === "summary"
                  ? "Codes + Currency"
                  : "Ping Users"}
            </button>
          ))}

          {availableCurrencies.length > 0 && (
            <>
              <span className="text-sm font-medium text-neutral-400 ml-2">
                Currency:
              </span>
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
                disabled={confirmLoading}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 outline-none focus:border-neutral-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All</option>
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {checked.size > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => handleMarkDone(false)}
              disabled={confirmLoading}
              className="flex-1 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Mark {checked.size} Orders as Done
            </button>
            <button
              onClick={() => handleMarkDone(true)}
              disabled={confirmLoading}
              className="flex-1 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Mark {checked.size} Done + Delete
            </button>
          </div>
        )}

        {byBuyer.length === 0 ? (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
            No active first-position orders.
          </div>
        ) : (
          <div className="space-y-4">
            {byBuyer.map((buyer) => {
              const hasCards = getBuyerCards(buyer).length > 0;
              return (
                <div
                  key={buyer.discord_id}
                  className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
                >
                  <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/50 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-mono text-white truncate">
                        {formatDiscordId(buyer.discord_id)}
                      </span>
                      <span className="text-xs text-neutral-500 shrink-0">
                        {getBuyerCards(buyer).length} cards •{" "}
                        {getBuyerSummary(buyer) || "—"}
                      </span>
                    </div>
                    <button
                      onClick={() => copyBuyerInfo(buyer)}
                      className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition cursor-pointer shrink-0 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        (!hasCards && copyFormat !== "ping") || confirmLoading
                      }
                    >
                      <Copy size={14} />{" "}
                      {copiedBuyer === buyer.discord_id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    {buyer.cards.map((tier) => {
                      const currency = tier.currency_type || "silver";
                      if (
                        currencyFilter !== "all" &&
                        currency !== currencyFilter
                      )
                        return null;
                      return (
                        <div key={tier.price_tier} className="mb-3 last:mb-0">
                          <div className="text-xs font-medium text-neutral-500 mb-2">
                            {tier.price_tier} {currency} (
                            {tier.card_codes.length} cards)
                          </div>
                          <div className="space-y-1.5">
                            {tier.card_codes.map(
                              (code: string, idx: number) => {
                                const orderId = tier.order_ids[idx];
                                return (
                                  <div
                                    key={code}
                                    className="flex items-center justify-between group pl-2 border-l-2 border-emerald-500/50"
                                  >
                                    <label
                                      className={`flex items-center gap-2 flex-1 min-w-0 ${
                                        confirmLoading
                                          ? "cursor-not-allowed"
                                          : "cursor-pointer"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked.has(orderId)}
                                        onChange={() => toggleCheck(orderId)}
                                        disabled={confirmLoading}
                                        className="cursor-pointer rounded border-neutral-700 bg-neutral-950 text-emerald-500 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                      <span className="text-sm text-neutral-300 truncate">
                                        {code}
                                      </span>
                                      <span className="text-[10px] font-medium text-emerald-500 shrink-0">
                                        #1
                                      </span>
                                    </label>
                                    <button
                                      onClick={() =>
                                        handleRemoveOrder(
                                          orderId,
                                          code,
                                          buyer.discord_id,
                                        )
                                      }
                                      disabled={confirmLoading}
                                      className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 cursor-pointer p-1 shrink-0 transition disabled:opacity-0 disabled:cursor-not-allowed"
                                      title={`Remove ${code}`}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
