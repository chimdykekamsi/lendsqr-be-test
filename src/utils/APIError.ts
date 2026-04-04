// src/lib/errors/APIError.ts
import { ZodError } from "zod";
import { winstonLogger } from "./logger";

// Define reusable error detail types
export type ErrorDetails = string | Record<string, unknown> | unknown[] | undefined;

export class APIError extends Error {
    statusCode: number;
    details?: ErrorDetails;

    constructor(statusCode: number, message: string, details?: ErrorDetails) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;

        Object.setPrototypeOf(this, new.target.prototype);

        if (process.env.NODE_ENV !== "production") {
            winstonLogger.error(this.stack);
        }
    }

    // Static helpers
    static BadRequest(message: string, details?: ErrorDetails) {
        return new APIError(400, message, details);
    }

    static Unauthorized(message = "Unauthorized") {
        return new APIError(401, message);
    }

    static Forbidden(message = "Forbidden") {
        return new APIError(403, message);
    }

    static NotFound(message = "Not Found") {
        return new APIError(404, message);
    }

    static Conflict(message = "Conflict") {
        return new APIError(409, message);
    }

    static PaymentRequired(message = "Payment Required") {
        return new APIError(402, message);
    }

    static Internal(message = "Internal Server Error") {
        return new APIError(500, message);
    }

    static UnprocessableEntity(message = "Unprocessable Entity") {
        return new APIError(422, message);
    }

    // 🔍 Parse raw errors (Zod, Prisma, etc.)
    static from(err: unknown): APIError {
        if (err instanceof APIError) return err;

        if (err instanceof ZodError) {
            const firstIssue = err.issues[0];
            const path = firstIssue?.path.join(".");
            const message = `${firstIssue?.message} (${path})`;
            return APIError.BadRequest(`Validation failed: ${message}`, err.issues);
        }

        // Prisma errors (example: unique constraint)
        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            err.code === "P2002"
        ) {
            return APIError.Conflict("Duplicate field value violates unique constraint");
        }

        if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            err.code === "P2002"
        ) {
            return APIError.Conflict("A subscription already exists for this plan. Please complete or cancel it.");
        }

        if (err instanceof Error) {
            return APIError.Internal(err.message);
        }

        return APIError.Internal("Unknown server error");
    }

    toJSON() {
        return {
            success: false,
            statusCode: this.statusCode,
            message: this.message,
            ...(this.details && { details: this.details }),
        };
    }
}
