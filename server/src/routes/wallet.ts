import { Router } from "express";
import type { createWalletController } from "../controllers/walletController.js";

export function createWalletRouter(controller: ReturnType<typeof createWalletController>): Router {
  const router = Router();
  router.get("/", controller.getWallet);
  return router;
}
