import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "./errors.js";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError("Invalid request body", result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ValidationError("Invalid request params", result.error.issues));
      return;
    }
    Object.assign(req.params, result.data);
    next();
  };
}
