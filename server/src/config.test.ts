import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws at load time when NODE_ENV=production and CORS_ORIGIN is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGIN;
    await expect(import("./config.js")).rejects.toThrow(/CORS_ORIGIN/);
  });

  it("falls back to localhost when not production and CORS_ORIGIN is unset", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.CORS_ORIGIN;
    const { config } = await import("./config.js");
    expect(config.corsOrigins).toEqual(["http://localhost:5173"]);
  });

  it("splits a comma-separated CORS_ORIGIN into trimmed origins", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://a.example.com, https://b.example.com";
    const { config } = await import("./config.js");
    expect(config.corsOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("uses PORT from env, defaulting to 4000", async () => {
    delete process.env.PORT;
    const { config: withDefault } = await import("./config.js");
    expect(withDefault.port).toBe(4000);

    vi.resetModules();
    process.env.PORT = "8080";
    const { config: withOverride } = await import("./config.js");
    expect(withOverride.port).toBe(8080);
  });
});
