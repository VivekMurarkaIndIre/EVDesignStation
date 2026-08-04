import type { Session } from "../models/index.js";
import type { SessionRepository } from "./SessionRepository.js";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  async save(session: Session): Promise<Session> {
    this.sessions.set(session.id, { ...session });
    return { ...session };
  }

  async findById(id: string): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    return session ? { ...session } : undefined;
  }
}
