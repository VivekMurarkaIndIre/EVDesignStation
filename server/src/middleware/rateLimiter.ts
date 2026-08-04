import rateLimit from "express-rate-limit";

/** Applied to the session start/stop endpoints — the only ones that mutate state. */
export function createSessionActionRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again shortly." },
  });
}
