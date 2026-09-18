"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  ChevronDown,
} from "lucide-react";

interface NavPillProps {
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
}

export default function NavPill({ name, email, image, isAdmin }: NavPillProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    const load = () => {
      setOpen(false);
    };
    load();
  }, [pathname]);

  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm px-1.5 py-1.5 shadow-2xl shadow-black/40">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-800/60 hover:text-neutral-100"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Card Manager</span>
        </Link>

        <span className="h-4 w-px bg-neutral-800" />

        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            pathname.startsWith("/dashboard")
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        {/* Admin (only for admins) */}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              pathname.startsWith("/admin")
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}

        <span className="h-4 w-px bg-neutral-800" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition hover:bg-neutral-800/60"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={name}
                className="h-6 w-6 rounded-full border border-neutral-800"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-[10px] font-medium text-neutral-300">
                {initials}
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 text-neutral-500 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/50">
              <div className="border-b border-neutral-800 px-4 py-3">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {name}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
