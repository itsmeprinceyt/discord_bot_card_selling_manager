"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import {
  Database,
  Home,
  LayoutDashboard,
  ShieldCheck,
  ScrollText,
  KeyRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SessionUserClient } from "../../../types/User/JWT.types";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const USER_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  {
    href: "/admin",
    label: "Dashboard",
    icon: ShieldCheck,
    exact: true,
  },
  { href: "/admin/invite-code", label: "Invite Code", icon: KeyRound },
];

function Avatar({
  name,
  image,
  size,
}: {
  name: string;
  image: string | null;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?").charAt(0).toUpperCase();

  if (!image || failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-xs font-medium text-neutral-300"
      >
        {initials}
      </span>
    );
  }

  return (
    <Image
      loading="eager"
      src={image}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full border border-neutral-800 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function NavItem({
  link,
  expanded,
  active,
}: {
  link: NavLink;
  expanded: boolean;
  active: boolean;
}) {
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      title={!expanded ? link.label : undefined}
      aria-label={link.label}
      className={`flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-sm transition cursor-pointer ${
        active
          ? "bg-neutral-800 text-neutral-100"
          : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span
        className={`truncate whitespace-nowrap transition-opacity duration-200 ${
          expanded ? "opacity-100" : "opacity-0"
        }`}
      >
        {link.label}
      </span>
    </Link>
  );
}

function SectionLabel({
  label,
  expanded,
}: {
  label: string;
  expanded: boolean;
}) {
  return (
    <div className="relative flex h-6 items-center overflow-hidden px-2.5">
      <span
        className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-neutral-600 transition-opacity duration-200 ${
          expanded ? "opacity-100" : "opacity-0"
        }`}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-x-2.5 top-1/2 h-px -translate-y-1/2 bg-neutral-800 transition-opacity duration-200 ${
          expanded ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}

export default function Sidebar({
  user,
  expanded,
  onToggle,
}: {
  user: SessionUserClient;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  function isActive(link: NavLink): boolean {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(link.href + "/");
  }

  const showSections = user.is_admin;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-neutral-800 bg-neutral-900 transition-[width] duration-300 ease-out ${
        expanded ? "w-70" : "w-14"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-neutral-800 px-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        <Link
          href="/"
          className={`ml-2.5 flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-200 transition-opacity duration-200 ${
            expanded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <Database size={14} className="shrink-0 text-neutral-400" />
          <span className="truncate">Card Manager</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {showSections ? (
          <>
            <SectionLabel label="Admin" expanded={expanded} />
            {ADMIN_LINKS.map((link) => (
              <NavItem
                key={link.href}
                link={link}
                expanded={expanded}
                active={isActive(link)}
              />
            ))}

            <SectionLabel label="User" expanded={expanded} />
            {USER_LINKS.map((link) => (
              <NavItem
                key={link.href}
                link={link}
                expanded={expanded}
                active={isActive(link)}
              />
            ))}
          </>
        ) : (
          USER_LINKS.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              expanded={expanded}
              active={isActive(link)}
            />
          ))
        )}
      </nav>

      <div className="shrink-0 border-t border-neutral-800 p-2">
        {expanded ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 overflow-hidden px-2 py-1.5">
              <Avatar name={user.name} image={user.image} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-neutral-100">
                  {user.name}
                </p>
                <p className="truncate text-[11px] leading-tight text-neutral-500">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-red-400 cursor-pointer"
            >
              <LogOut size={16} className="shrink-0" />
              <span
                className={`truncate whitespace-nowrap transition-opacity duration-200 ${
                  expanded ? "opacity-100" : "opacity-0"
                }`}
              >
                Sign out
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            title="Expand"
            aria-label="Expand sidebar"
            className="mx-auto flex items-center justify-center rounded-full p-0.5 transition hover:bg-neutral-800 cursor-pointer"
          >
            <Avatar name={user.name} image={user.image} size={32} />
          </button>
        )}
      </div>
    </aside>
  );
}
