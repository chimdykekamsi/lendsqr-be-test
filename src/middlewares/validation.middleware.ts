import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema) =>
    (req: Request, res: Response, next: NextFunction): void => {
      const result = schema.parse(req.body);

      req.body = result;
      next();
    };
