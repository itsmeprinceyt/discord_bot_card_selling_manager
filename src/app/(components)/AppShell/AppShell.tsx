"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar/Sidebart";
import { SessionUserClient } from "../../../types/User/JWT.types";

export default function AppShell({
  user,
  children,
}: {
  user: SessionUserClient | null;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);

    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const load = () => {
      if (isMobile) setExpanded(false);
    };
    load();
  }, [pathname, isMobile]);

  if (!user) return <>{children}</>;

  const overlayOpen = isMobile && expanded;

  return (
    <>
      <Sidebar
        user={user}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />

      {overlayOpen && (
        <div
          onClick={() => setExpanded(false)}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <div
        className={`min-h-screen transition-[padding] duration-300 ease-out ${
          expanded && !isMobile ? "pl-70" : "pl-14"
        }`}
      >
        {children}
      </div>
    </>
  );
}
