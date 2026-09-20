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
  Home,
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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const load = () => {
      setOpen(false);
    };
    load();
  }, [pathname]);

  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/70 backdrop-blur-sm px-1.5 py-1.5 shadow-2xl shadow-black/40">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center justify-center rounded-full p-2 text-neutral-400 transition hover:bg-neutral-800/60 hover:text-neutral-100 cursor-pointer"
        >
          <Home size={14} />
        </Link>

        <span className="h-4 w-px bg-neutral-800" />

        <Link
          href="/dashboard"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
            pathname.startsWith("/dashboard")
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
          }`}
        >
          <LayoutDashboard size={14} />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              pathname.startsWith("/admin")
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
            }`}
          >
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}

        <span className="h-4 w-px bg-neutral-800" />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition hover:bg-neutral-800/60 cursor-pointer"
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
              size={12}
              className={`text-neutral-500 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <div className="fixed inset-x-4 top-16 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64">
              <div className="border-b border-neutral-800 px-4 py-3">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {name}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 break-all">
                  {email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-red-400 cursor-pointer"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
