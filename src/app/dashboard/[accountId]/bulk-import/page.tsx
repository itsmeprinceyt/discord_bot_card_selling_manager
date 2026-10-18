"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Undo2, Brush, RotateCcw, Upload } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import CustomLoader from "../../../(components)/CustomLoader";
import getAxiosErrorMessage from "../../../../utils/Auth/Auth.AxiosHelper";
import {
  GameType,
  getValidCurrencies,
} from "../../../../utils/Dashboard/accountLabels";
import { BulkImportResult } from "../../../../types/BulkImport.types";

export default function BulkImportPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<{
    game_type: GameType;
  } | null>(null);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [userSelectedCurrency, setUserSelectedCurrency] = useState<
    string | null
  >(null);

  const [buyerId, setBuyerId] = useState("");
  const [priceTier, setPriceTier] = useState("");
  const [rawText, setRawText] = useState("");
  const [extracted, setExtracted] = useState("");
  const [copied, setCopied] = useState(false);

  const [undoStack, setUndoStack] = useState<string[]>([]);

  const lastShiftTapRef = useRef<number>(0);
  const DOUBLE_TAP_THRESHOLD = 400;

  useEffect(() => {
    async function fetchAccount() {
      try {
        const { data } = await axios.get(
          `/api/dashboard/accounts/${accountId}`,
          { withCredentials: true },
        );
        setAccount(data.account);
      } catch (err) {
        toast.error(getAxiosErrorMessage(err, "Failed to fetch account"));
      }
    }
    if (accountId) fetchAccount();
  }, [accountId]);

  const currencyOptions = useMemo(() => {
    return account ? getValidCurrencies(account.game_type) : [];
  }, [account]);

  const currencyType = useMemo(() => {
    if (!account) return "";

    const saved = localStorage.getItem(`bulk_currency_${accountId}`);
    if (saved && currencyOptions.includes(saved)) {
      return saved;
    }

    if (
      userSelectedCurrency &&
      currencyOptions.includes(userSelectedCurrency)
    ) {
      return userSelectedCurrency;
    }

    return currencyOptions[0];
  }, [account, accountId, currencyOptions, userSelectedCurrency]);

  const handleCurrencyChange = (value: string) => {
    setUserSelectedCurrency(value);
    localStorage.setItem(`bulk_currency_${accountId}`, value);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data } = await axios.post(
        `/api/dashboard/accounts/${accountId}/orders/bulk-import`,
        { rawText: text, currency_type: currencyType },
        { withCredentials: true },
      );
      setResult(data);
      if (data.imported > 0) setText("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Bulk import failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previous = undoStack[undoStack.length - 1];
      setUndoStack(undoStack.slice(0, -1));
      setText(previous);
    }
  };

  const handleClean = useCallback(() => {
    setText((currentText) => {
      if (!currentText.trim()) return currentText;
      setUndoStack((prevStack) => [...prevStack, currentText]);

      const commandsToRemove = [
        "sv",
        "s",
        "view",
        "show",
        "info",
        "card",
        "c",
        "v",
        "lookup",
        "l",
        "get",
        "check",
      ];
      const currencyWordsToRemove =
        /^(silver|silv|silvers?|gold|gld|wist|wists?|tickets?)$/i;

      const lines = currentText.split("\n");
      const cleanedLines = lines.map((line) => {
        let parts = line.trim().split(/\s+/);
        if (parts.length < 3) return line;

        parts = parts.filter(
          (part) => !commandsToRemove.includes(part.toLowerCase()),
        );
        parts = parts.filter((part) => !currencyWordsToRemove.test(part));
        if (parts.length < 3) return line;

        const discordId = parts[0];
        const cardCode = parts[1];
        let priceTier = parts[2];

        priceTier = priceTier
          .replace(/s(i(l(v(e(r)?)?)?)?)?$/i, "")
          .replace(/g(o(l(d)?)?)?$/i, "")
          .replace(/w(i(s(t)?)?)?$/i, "")
          .replace(/t(i(c(k(e(t(s)?)?)?)?)?)?$/i, "")
          .trim();

        return `${discordId} ${cardCode} ${priceTier}`;
      });

      return cleanedLines.join("\n");
    });
  }, []);

  const handleBulkTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.code !== "ShiftLeft") return;
      const now = Date.now();
      const timeSinceLastTap = now - lastShiftTapRef.current;
      if (timeSinceLastTap > 0 && timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
        lastShiftTapRef.current = 0;
        handleClean();
      } else {
        lastShiftTapRef.current = now;
      }
    },
    [handleClean],
  );

  const extractCardCodes = () => {
    if (!buyerId.trim() || !rawText.trim() || !priceTier.trim()) return;

    const buyerMatch = buyerId.match(/<@!?(\d+)>|(\d+)/);
    const cleanBuyerId = buyerMatch
      ? buyerMatch[1] || buyerMatch[2]
      : buyerId.trim();

    const commonCommands = [
      "sv",
      "s",
      "view",
      "show",
      "info",
      "card",
      "c",
      "v",
      "lookup",
      "l",
      "get",
      "check",
    ];
    const currencyWords =
      /^(silver|silv|silvers?|gold|gld|wist|wists?|w\/\s*wist|w\/\s*wists|tickets?)$/i;

    const lines = rawText.split("\n").filter((line) => line.trim());
    const cardCodes: string[] = [];

    lines.forEach((line) => {
      let cleaned = line.replace(/<@!?\d+>/g, "").trim();
      cleaned = cleaned.replace(/pings me\s*/i, "");
      const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

      const filteredWords = words.filter((word) => {
        const lower = word.toLowerCase();
        if (commonCommands.includes(lower)) return false;
        if (currencyWords.test(lower)) return false;
        if (/^\d+(s|g|silver|gold)?$/i.test(lower)) return false;
        return true;
      });

      filteredWords.forEach((word) => {
        if (/^[a-zA-Z0-9_-]{3,}$/.test(word)) cardCodes.push(word);
      });
    });

    setExtracted(
      cardCodes
        .map((code) => `${cleanBuyerId} ${code} ${priceTier}`)
        .join("\n"),
    );
  };

  const copyExtracted = () => {
    navigator.clipboard.writeText(extracted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetExtractor = () => {
    setBuyerId("");
    setPriceTier("");
    setRawText("");
    setExtracted("");
  };

  if (!currencyType) return <CustomLoader />;

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
              Bulk Import
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Add multiple orders at once
            </p>
          </div>
        </div>

        <div className="mb-12 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-400 mb-4">
            One order per line:{" "}
            <span className="text-neutral-200 font-mono">
              discordId cardCode priceTier
            </span>
          </p>

          <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-500 font-mono">
            123456789 ABC123 300
            <br />
            123456789 DEF456 300
            <br />
            555555555 XYZ999 500
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Default Currency
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

          <form onSubmit={handleImport}>
            <textarea
              value={text}
              onChange={(e) => {
                setUndoStack([...undoStack, text]);
                setText(e.target.value);
              }}
              onKeyDown={handleBulkTextareaKeyDown}
              placeholder="123456789 ABC123 300&#10;123456789 DEF456 300&#10;555555555 XYZ999 500"
              rows={10}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600 resize-y mb-3 font-mono"
            />

            <div className="flex gap-3 mb-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
              >
                <Undo2 size={16} /> Undo
              </button>
              <button
                type="button"
                onClick={handleClean}
                disabled={!text.trim()}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
              >
                <Brush size={16} /> Clean
              </button>
            </div>

            <p className="text-xs text-neutral-500 mb-4">
              Tip: double tap{" "}
              <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 font-mono text-neutral-400">
                Shift
              </kbd>{" "}
              to clean
            </p>

            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="w-full cursor-pointer rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              {loading ? "Importing..." : "Import Orders"}
            </button>
          </form>

          {result && (
            <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="text-sm font-semibold text-neutral-200 mb-3">
                Import Results
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">
                    {result.imported}
                  </div>
                  <div className="text-xs text-neutral-500">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">
                    {result.duplicates}
                  </div>
                  <div className="text-xs text-neutral-500">Duplicates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {result.errors}
                  </div>
                  <div className="text-xs text-neutral-500">Errors</div>
                </div>
              </div>
              {result.errorDetails?.length > 0 && (
                <div className="border-t border-neutral-800 pt-3">
                  <div className="text-xs font-medium text-neutral-500 mb-2">
                    Error Details
                  </div>
                  <div className="space-y-1">
                    {result.errorDetails.map((e: string, i: number) => (
                      <div key={i} className="text-xs text-red-400">
                        {e}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-1">
            Card Code Extractor
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            Paste raw messages to extract card codes into bulk import format
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-400">
                  Buyer ID
                </label>
                <button
                  type="button"
                  onClick={handleResetExtractor}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-200 transition cursor-pointer"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
              <input
                type="text"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                placeholder="123456789 or <@123456789>"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Price Tier
                </label>
                <input
                  type="text"
                  value={priceTier}
                  onChange={(e) => setPriceTier(e.target.value)}
                  placeholder="300"
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

            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Raw Messages
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`<@1402731478122631289> sv b1open 500 silver\n<@1402731478122631289> sv aq3irr 500 w/ wist`}
                rows={6}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600 resize-y"
              />
            </div>

            <button
              onClick={extractCardCodes}
              disabled={!buyerId.trim() || !rawText.trim() || !priceTier.trim()}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
            >
              Extract Card Codes
            </button>
          </div>

          {extracted && (
            <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-neutral-200">
                  Extracted Format
                </div>
                <button
                  onClick={copyExtracted}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                >
                  <Copy size={14} /> {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono">
                {extracted}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
