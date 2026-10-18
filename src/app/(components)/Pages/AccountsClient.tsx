"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ArrowUpDown,
  ChevronRight,
  LayoutDashboard,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import ConfirmDialog from "../ConfirmDialog";
import { GAME_LABEL, GameType } from "../../../utils/Dashboard/accountLabels";
import getAxiosErrorMessage from "../../../utils/Auth/Auth.AxiosHelper";
import { AccountItem, SortOption } from "../../../types/AccountsClient.types";

const SORT_LABEL: Record<SortOption, string> = {
  az: "Name (A–Z)",
  pending: "Pending trades",
};

export default function AccountsClient({ firstName }: { firstName: string }) {
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [sortBy, setSortBy] = useState<SortOption>("az");
  const [sortOpen, setSortOpen] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createGameType, setCreateGameType] = useState<GameType>("SOFI");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<AccountItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: "default" | "danger";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "default",
    onConfirm: () => {},
  });

  /* ----------------------------- fetch list ----------------------------- */
  const fetchAccounts = useCallback(async () => {
    setPageError("");
    try {
      const { data } = await axios.get<{
        ok: true;
        accounts: AccountItem[];
      }>("/api/dashboard/accounts", { withCredentials: true });

      setAccounts(data.accounts ?? []);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.push("/login");
        return;
      }
      setPageError(getAxiosErrorMessage(err, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const load = () => {
      fetchAccounts();
    };
    load();
  }, [fetchAccounts]);

  /* ------------------------------- create ------------------------------- */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await axios.post(
        "/api/dashboard/accounts",
        { name: createName, game_type: createGameType },
        { withCredentials: true },
      );

      setShowCreate(false);
      setCreateName("");
      setCreateGameType("SOFI");
      await fetchAccounts();
    } catch (err) {
      setCreateError(getAxiosErrorMessage(err, "Failed to create account"));
    } finally {
      setCreating(false);
    }
  }

  /* ------------------------------- rename ------------------------------- */
  function openRename(account: AccountItem) {
    setRenameTarget(account);
    setRenameValue(account.name);
    setRenameError("");
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    setRenameError("");
    setRenaming(true);
    try {
      await axios.put(
        `/api/dashboard/accounts/${renameTarget.id}`,
        { name: renameValue },
        { withCredentials: true },
      );

      setRenameTarget(null);
      await fetchAccounts();
    } catch (err) {
      setRenameError(getAxiosErrorMessage(err, "Failed to rename account"));
    } finally {
      setRenaming(false);
    }
  }

  /* ------------------------------- delete ------------------------------- */
  function askDelete(account: AccountItem) {
    setConfirm({
      isOpen: true,
      title: "Delete account",
      message: `Delete "${account.name}"?\n\nThis permanently deletes all cards, buyers, orders and activity for this account. This cannot be undone.`,
      confirmText: "Delete account",
      variant: "danger",
      onConfirm: async () => {
        setDeletingId(account.id);
        try {
          await axios.delete(`/api/dashboard/accounts/${account.id}`, {
            withCredentials: true,
          });
          await fetchAccounts();
        } catch (err) {
          setPageError(getAxiosErrorMessage(err, "Failed to delete account"));
        } finally {
          setDeletingId(null);
          setConfirm((p) => ({ ...p, isOpen: false }));
        }
      },
    });
  }

  /* ------------------------------- sort ------------------------------- */
  const sorted = useMemo(() => {
    const list = [...accounts];
    if (sortBy === "az")
      return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => b.pending_count - a.pending_count);
  }, [accounts, sortBy]);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-400">
        <div className="mx-auto w-full max-w-3xl text-sm">
          Loading accounts…
        </div>
      </main>
    );
  }

  /* --------------------------------- UI --------------------------------- */
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
            <LayoutDashboard size={20} className="text-neutral-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Hi, {firstName}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Select an account to continue.
            </p>
          </div>
        </div>

        {/* Sort bar */}
        <div className="mt-8 flex items-center justify-between">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200"
            >
              <ArrowUpDown size={13} />
              Sort: {SORT_LABEL[sortBy]}
            </button>
            {sortOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
                {(["az", "pending"] as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSortBy(opt);
                      setSortOpen(false);
                    }}
                    className={`block w-full cursor-pointer px-3 py-2 text-left text-xs transition hover:bg-neutral-800 ${
                      sortBy === opt ? "text-neutral-100" : "text-neutral-400"
                    }`}
                  >
                    {opt === "az"
                      ? "Name (A–Z)"
                      : "Pending trades (highest first)"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-neutral-500">
            {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </span>
        </div>

        {pageError && <p className="mt-4 text-sm text-red-400">{pageError}</p>}

        <div className="mt-4 space-y-2">
          {sorted.length === 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
              No accounts yet — create your first one below.
            </div>
          )}

          {sorted.map((account) => (
            <div
              key={account.id}
              className="flex items-stretch overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition hover:border-neutral-700"
            >
              <Link
                href={`/dashboard/${account.id}`}
                className="flex flex-1 items-center justify-between gap-4 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400">
                    <Wallet size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-neutral-100">
                        {account.name}
                      </p>
                      {account.pending_count > 0 && (
                        <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          {account.pending_count} pending
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {GAME_LABEL[account.game_type]}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-neutral-600" />
              </Link>

              <div className="flex items-center border-l border-neutral-800">
                <button
                  type="button"
                  onClick={() => openRename(account)}
                  className="flex h-full cursor-pointer items-center px-3 text-neutral-600 transition hover:text-neutral-200"
                  aria-label="Rename"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => askDelete(account)}
                  disabled={deletingId === account.id}
                  className="flex h-full cursor-pointer items-center px-3 text-neutral-600 transition hover:text-red-400 disabled:opacity-30"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setShowCreate(true);
            }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 px-4 py-4 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-100"
          >
            <Plus size={16} />
            Create new account
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-100">
                Create account
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="cursor-pointer rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-5 space-y-3">
              <input
                type="text"
                placeholder="Account name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={255}
                required
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-neutral-600"
              />
              <select
                value={createGameType}
                onChange={(e) => setCreateGameType(e.target.value as GameType)}
                className="w-full cursor-pointer rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
              >
                <option value="SOFI">SOFI (Silver &amp; Wist)</option>
                <option value="KARUTA">KARUTA (Gold &amp; Tickets)</option>
              </select>
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 cursor-pointer rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 cursor-pointer rounded-lg border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => !renaming && setRenameTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-100">
                  Rename account
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {GAME_LABEL[renameTarget.game_type]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="cursor-pointer rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRename} className="mt-5 space-y-3">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={255}
                required
                autoFocus
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-600"
              />
              {renameError && (
                <p className="text-xs text-red-400">{renameError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={renaming}
                  className="flex-1 cursor-pointer rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
                >
                  {renaming ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="flex-1 cursor-pointer rounded-lg border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={() => setConfirm((p) => ({ ...p, isOpen: false }))}
        onConfirm={confirm.onConfirm}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        variant={confirm.variant}
        loading={deletingId !== null}
      />
    </main>
  );
}
