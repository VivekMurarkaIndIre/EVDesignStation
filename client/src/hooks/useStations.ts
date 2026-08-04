import type { Station } from "@ev/shared";
import { useCallback, useEffect, useState } from "react";
import { getStations } from "../api/client";

const POLL_INTERVAL_MS = 5000;

export function useStations() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getStations();
      setStations(result);
      setError(null);
    } catch {
      setError("Couldn't load stations. Retrying shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { stations, loading, error, refresh };
}
