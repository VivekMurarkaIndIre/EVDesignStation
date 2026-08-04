import express from "express";
import { SHARED_PACKAGE_READY } from "@ev/shared";

export function createApp() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", sharedPackageReady: SHARED_PACKAGE_READY });
  });

  return app;
}
