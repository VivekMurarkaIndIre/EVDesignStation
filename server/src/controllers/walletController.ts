import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type { WalletService } from "../services/walletService.js";

export function createWalletController(walletService: WalletService) {
  return {
    getWallet: asyncHandler(async (_req: Request, res: Response) => {
      const wallet = await walletService.getWallet();
      res.json(wallet);
    }),
  };
}
