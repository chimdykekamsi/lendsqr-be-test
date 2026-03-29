// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { APIError } from "@/utils/APIError";
import { APIResponse } from "@/utils/APIResponse";
import { winstonLogger } from "@/utils/logger";

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const error = APIError.from(err);
    winstonLogger.error(`[${req.method}] ${req.originalUrl} -> ${error.message}`);

    return APIResponse.error(res, error.message, error.statusCode, error.details);
};
