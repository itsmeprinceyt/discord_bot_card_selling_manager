"use client";

import { useCallback, useEffect, useState } from "react";
import axios, { AxiosError } from "axios";
import getAxiosErrorMessage from "../../../utils/Auth/Auth.AxiosHelper";

/* -------------------------- types -------------------------- */
interface Account {
  id: string;
  name: string;
  game_type: "SOFI" | "KARUTA";
  created_at: string;
}

interface ApiErrorBody {
  ok: false;
  error: string;
}

export default function AccountSingle({ accountId }: { accountId: string }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* -------------------- fetch this account -------------------- */
  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<{ ok: true; account: Account }>(
        `/api/dashboard/accounts/${accountId}`,
        { withCredentials: true },
      );
      setAccount(data.account);
    } catch (err) {
      setError(getAxiosErrorMessage(err, "Failed to load account"));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  /* -------------------- render -------------------- */
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        {loading && (
          <p className="text-sm text-neutral-500">Loading account…</p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {account && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <h1 className="text-xl font-semibold">{account.name}</h1>
            <p className="mt-1 text-xs text-neutral-500">
              {account.game_type} ·{" "}
              <span className="text-neutral-400">{account.id}</span>
            </p>
            <p className="mt-4 text-sm text-neutral-400">
              Cards, buyers, orders coming here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
