import type { Wallet } from "@ev/shared";
import { useCallback, useEffect, useState } from "react";
import { getWallet } from "../api/client";

const POLL_INTERVAL_MS = 5000;

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getWallet();
      setWallet(result);
      setError(null);
    } catch {
      setError("Couldn't load wallet balance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { wallet, loading, error, refresh };
}
