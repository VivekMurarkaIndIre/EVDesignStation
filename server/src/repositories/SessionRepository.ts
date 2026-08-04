import type { Session } from "../models/index.js";

export interface SessionRepository {
  /** Insert or update by id. */
  save(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | undefined>;
}
