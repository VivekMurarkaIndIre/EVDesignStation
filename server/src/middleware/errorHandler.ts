import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors.js";

function isBodyParserSyntaxError(err: unknown): err is SyntaxError & { status: number } {
  return err instanceof SyntaxError && "status" in err && (err as { status?: unknown }).status === 400;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (isBodyParserSyntaxError(err)) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
