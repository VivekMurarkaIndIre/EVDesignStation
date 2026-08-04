import type { RateSchedule, Session, Station, Wallet } from "@ev/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error ?? "Request failed", res.status);
  }

  return res.json() as Promise<T>;
}

export function getStations(): Promise<Station[]> {
  return request<Station[]>("/stations");
}

export function startSession(stationId: string, autoStopAfterMinutes?: number): Promise<Session> {
  return request<Session>("/sessions", { method: "POST", body: JSON.stringify({ stationId, autoStopAfterMinutes }) });
}

export function stopSession(sessionId: string): Promise<Session> {
  return request<Session>(`/sessions/${sessionId}/stop`, { method: "PATCH" });
}

export function getSession(sessionId: string): Promise<Session> {
  return request<Session>(`/sessions/${sessionId}`);
}

export function getWallet(): Promise<Wallet> {
  return request<Wallet>("/wallet");
}

export function getRateSchedule(): Promise<RateSchedule> {
  return request<RateSchedule>("/rate-schedule");
}
