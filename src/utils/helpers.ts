import { idempotencyService } from "@/modules/Idempotency/idempotency.service";
import crypto from "crypto";
import { Request, Response } from "express";
import { uuid } from "uuidv4";
import { APIResponse } from "./APIResponse";
import { Currency, CURRENCY_CONFIG } from "@/modules/Transactions/transaction.type";

export const generateReference = (prefix: string): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuid().replace(/-/g, "").substring(0, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

// ─── Hashing ─────────────────────────────────────────────────────────────────

export const hashObject = (obj: unknown): string => {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(obj))
        .digest("hex");
};

export const formatAmount = (dbAmount: number, currencyConfig: typeof CURRENCY_CONFIG[Currency]): number => {
    return Number((dbAmount / currencyConfig.multiplier).toFixed(currencyConfig.decimal_places));
}

/**
 * @param controller 
 * @returns API response with idempotency handling. The controller should return an object with the following structure:
 * {
 *   message: string,
 *  data: any,
 *  statusCode: number
 * }
 */
export const idempotentControllerWrapper = (controller: Function) => {
    return async (req: Request, res: Response) => {
        try {
            const result = await controller(req, res);
            if (req.idempotencyKey) {
                idempotencyService.completeKey(req.user!.id, req.idempotencyKey!, {
                    message: result.message,
                    data: result.data,
                    statusCode: result.statusCode,
                });
            }
            return APIResponse.success(res, result.message, result.data, result.statusCode);
        } catch (error) {
            if (req.idempotencyKey) {
                idempotencyService.deleteKey(req.user!.id, req.idempotencyKey!);
            }
            throw error;
        }
    };
};
