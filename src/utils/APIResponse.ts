// src/utils/APIResponse.ts
import type { Response } from "express";
import type { ErrorDetails } from "./APIError";

export class APIResponse {
    /**
     * Send a success response
     */
    static success<T>(
        res: Response,
        message: string,
        data?: T,
        status = 200
    ): Response {
        return res.status(status).json({
            success: true,
            message,
            data,
        });
    }

    /**
     * Send an error response
     */
    static error(
        res: Response,
        message: string,
        status = 400,
        error?: ErrorDetails
    ): Response {
        return res.status(status).json({
            success: false,
            message,
            error,
        });
    }
}
