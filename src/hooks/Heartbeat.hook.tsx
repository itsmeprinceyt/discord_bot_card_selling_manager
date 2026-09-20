"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import axios from "axios";
import { getHeartbeatSessionKeys } from "../utils/Heartbeat/Heartbeat.session.util";

/**
 * @brief Pings the heartbeat endpoint and stamps the session on success.
 *
 * @description
 * Defined at module scope because it uses no component state or props.
 * This also avoids the react-hooks/immutability lint that fires when a
 * `const` declared inside a component is referenced by an effect above it.
 */
const triggerHeartbeat = async (): Promise<void> => {
  try {
    const response = await axios.get("/api/public/heartbeat");

    if (response.data.success) {
      const { sessionKey, expiryKey, ttl } = getHeartbeatSessionKeys();
      sessionStorage.setItem(sessionKey, "true");
      sessionStorage.setItem(expiryKey, (Date.now() + ttl).toString());
    }
  } catch (error: unknown) {
    console.error("Heartbeat failed:", error);
  }
};

const HeartbeatContent = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const { expiryKey } = getHeartbeatSessionKeys();
    const expiry = sessionStorage.getItem(expiryKey);
    const now = Date.now();

    if (expiry && now <= Number(expiry)) return;

    const timeout = setTimeout(() => {
      void triggerHeartbeat();
    }, 500);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return null;
};

const HomePageHeartbeat = dynamic(() => Promise.resolve(HeartbeatContent), {
  ssr: false,
  loading: () => null,
});

export default HomePageHeartbeat;
