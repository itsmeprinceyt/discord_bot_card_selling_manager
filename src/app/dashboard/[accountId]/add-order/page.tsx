"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import axios from "axios";
import CustomLoader from "../../../(components)/CustomLoader";
import toast from "react-hot-toast";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";
import {
  GameType,
  GAME_LABEL,
} from "../../../../utils/Dashboard/accountLabels";

export default function AddOrderPage() {
  const params = useParams();
  const router = useRouter();

  const accountId = params.accountId as string;

  const [account, setAccount] = useState<{
    game_type: GameType;
  } | null>(null);

  const [discordId, setDiscordId] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [priceTier, setPriceTier] = useState("");

  const [currencyType, setCurrencyType] = useState("");
  const [result, setResult] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Currency options based on game
  const currencyOptions = useMemo(() => {
    return account?.game_type === "SOFI"
      ? ["silver", "wist"]
      : ["gold", "tickets"];
  }, [account?.game_type]);

  // 1. Fetch account details
  useEffect(() => {
    async function fetchAccount() {
      try {
        const { data } = await axios.get(
          `/api/dashboard/accounts/${accountId}`,
          { withCredentials: true },
        );
        setAccount(data.account);
      } catch (err: unknown) {
        toast.error(
          getAxiosErrorMessage(err, "Failed to fetch account details"),
        );
        setIsReady(true);
      }
    }
    if (accountId) fetchAccount();
  }, [accountId]);

  // 2. Set initial currency
  useEffect(() => {
    const load = () => {
      if (account && currencyOptions.length > 0) {
        const saved = localStorage.getItem(`currency_${accountId}`);
        if (saved && currencyOptions.includes(saved)) {
          setCurrencyType(saved);
        } else {
          setCurrencyType(currencyOptions[0]);
        }
        setIsReady(true);
      }
    };
    load();
  }, [account, accountId, currencyOptions]);

  const handleCurrencyChange = (value: string) => {
    setCurrencyType(value);
    localStorage.setItem(`currency_${accountId}`, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);

    try {
      const { data } = await axios.post(
        `/api/dashboard/accounts/${accountId}/add-order`,
        {
          discord_id: discordId,
          card_code: cardCode,
          price_tier: parseInt(priceTier, 10),
          currency_type: currencyType,
        },
        { withCredentials: true },
      );

      const pos = data.queue_position;
      setResult({
        type: "success",
        message:
          pos === 1
            ? `Order added! ${cardCode} reserved for <@${discordId}> at position #1`
            : `Added to waitlist position #${pos} for card ${cardCode}`,
      });

      setDiscordId("");
      setCardCode("");
      setPriceTier("");
    } catch (err) {
      setResult({
        type: "error",
        message: getAxiosErrorMessage(err, "Failed to add order"),
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return <CustomLoader />;
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(`/dashboard/${accountId}`)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Add Order</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {account
                ? `Create a new reservation for ${GAME_LABEL[account.game_type]}`
                : "Create a new reservation"}
            </p>
          </div>
        </div>

        {/* Result Banner */}
        {result && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              result.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}
          >
            {result.message}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Discord User ID
            </label>
            <input
              type="text"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="1234567890"
              required
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Card Code
            </label>
            <input
              type="text"
              value={cardCode}
              onChange={(e) => setCardCode(e.target.value)}
              placeholder="ABC123"
              required
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Price Tier
              </label>
              <input
                type="number"
                value={priceTier}
                onChange={(e) => setPriceTier(e.target.value)}
                placeholder="300"
                min={1}
                required
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Currency
              </label>
              <select
                value={currencyType}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
              >
                {currencyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full cursor-pointer rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Order"}
          </button>
        </form>
      </div>
    </main>
  );
}
