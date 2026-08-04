import type { Session } from "@ev/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getSession, startSession, stopSession } from "../api/client";

const STORAGE_KEY = "ev-my-session-ids";
const ACTIVE_SESSION_POLL_INTERVAL_MS = 5000;

function loadStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveStoredIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Tracks the sessions this browser has started. There's no login, so
 * "my sessions" is just a locally-persisted list of ids; the server
 * (via getSession) remains the source of truth for their actual state,
 * which matters if it was restarted since the ids were stored.
 */
export function useMySessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingStationIds, setPendingStationIds] = useState<Set<string>>(new Set());
  const [pendingStopIds, setPendingStopIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    const ids = loadStoredIds();
    if (ids.length === 0) {
      return;
    }
    (async () => {
      const results = await Promise.all(
        ids.map((id) => getSession(id).catch(() => null)),
      );
      const valid = results.filter((session): session is Session => session !== null);
      setSessions(valid);
      saveStoredIds(valid.map((session) => session.id));
    })();
  }, []);

  // Sessions can now be auto-stopped server-side (balance depletion, or a
  // chosen duration elapsing) without any action here, so active sessions
  // need to be re-polled to pick up that change and the live chargeEstimate.
  useEffect(() => {
    const interval = setInterval(async () => {
      const activeIds = sessionsRef.current.filter((s) => s.endTime === null).map((s) => s.id);
      if (activeIds.length === 0) {
        return;
      }
      const updates = await Promise.all(activeIds.map((id) => getSession(id).catch(() => null)));
      setSessions((prev) => {
        const byId = new Map(updates.filter((s): s is Session => s !== null).map((s) => [s.id, s]));
        return prev.map((s) => byId.get(s.id) ?? s);
      });
    }, ACTIVE_SESSION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const start = useCallback(async (
    stationId: string,
    autoStopAfterMinutes?: number,
  ): Promise<{ ok: boolean; status?: number }> => {
    setError(null);
    setPendingStationIds((prev) => new Set(prev).add(stationId));
    try {
      const session = await startSession(stationId, autoStopAfterMinutes);
      setSessions((prev) => {
        const next = [session, ...prev];
        saveStoredIds(next.map((s) => s.id));
        return next;
      });
      return { ok: true };
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      // 402 (insufficient funds) is handled by redirecting to Load Funds
      // instead of showing an error banner underneath that redirect.
      if (status !== 402) {
        setError(err instanceof ApiError ? err.message : "Couldn't start session.");
      }
      return { ok: false, status };
    } finally {
      setPendingStationIds((prev) => {
        const next = new Set(prev);
        next.delete(stationId);
        return next;
      });
    }
  }, []);

  const stop = useCallback(async (sessionId: string) => {
    setError(null);
    setPendingStopIds((prev) => new Set(prev).add(sessionId));
    try {
      const updated = await stopSession(sessionId);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't stop session.");
    } finally {
      setPendingStopIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }, []);

  return { sessions, start, stop, pendingStationIds, pendingStopIds, error };
}
