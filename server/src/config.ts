const isProduction = process.env.NODE_ENV === "production";

/**
 * Fails fast at startup for missing required config instead of silently
 * falling back to a dev-only default once deployed (e.g. a production
 * CORS_ORIGIN that's missing would otherwise silently default to
 * localhost, which doesn't leak anything but does quietly break the app
 * for every real user until someone notices).
 */
function requireEnv(name: string, devDefault?: string): string {
  const value = process.env[name];
  if (value) {
    return value;
  }
  if (!isProduction && devDefault !== undefined) {
    return devDefault;
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: requireEnv("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim()),
};
