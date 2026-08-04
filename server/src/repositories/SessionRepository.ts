import type { Session } from "../models/index.js";

export interface SessionRepository {
  /** Insert or update by id. */
  save(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | undefined>;
  /** All sessions with endTime === null. */
  findActive(): Promise<Session[]>;

  /** Clears every session. Demo/testing convenience — see POST /reset. */
  reset(): Promise<void>;
}
