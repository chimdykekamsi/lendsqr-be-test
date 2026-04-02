import { Request, Response } from "express";
import { transactionService } from "./transaction.service";
import { APIResponse } from "@/utils/APIResponse";
import { APIError } from "@/utils/APIError";
import { TransactionType, TransactionStatus, TransactionQuerySchema } from "./transaction.type";

export class TransactionController {
    async getTransactions(req: Request, res: Response) {
        const user_id = req.user?.id;
        if (!user_id) {
            throw APIError.Unauthorized("User not authenticated");
        }

        const {
            transaction_type,
            status,
            amount_min,
            amount_max,
            date_from,
            date_to,
            limit
        } = TransactionQuerySchema.parse(req.query);

        const filters: any = { user_id };

        // Validate and set transaction type filter
        if (transaction_type) {
            const validTypes = Object.values(TransactionType);
            if (validTypes.includes(transaction_type as TransactionType)) {
                filters.type = transaction_type;
            } else {
                throw APIError.BadRequest("Invalid transaction type");
            }
        }

        // Validate and set status filter
        if (status) {
            const validStatuses = Object.values(TransactionStatus);
            if (validStatuses.includes(status as TransactionStatus)) {
                filters.status = status;
            } else {
                throw APIError.BadRequest("Invalid transaction status");
            }
        }

        // Validate and set amount filters
        if (amount_min !== undefined) {
            const minAmount = amount_min;
            if (isNaN(minAmount) || minAmount < 0) {
                throw APIError.BadRequest("Invalid amount_min");
            }
            filters.amount_min = Math.round(minAmount * 100); // Convert to kobo
        }

        if (amount_max !== undefined) {
            const maxAmount = amount_max;
            if (isNaN(maxAmount) || maxAmount < 0) {
                throw APIError.BadRequest("Invalid amount_max");
            }
            filters.amount_max = Math.round(maxAmount * 100); // Convert to kobo
        }

        // Validate and set date filters
        if (date_from) {
            const dateFrom = new Date(date_from);
            if (isNaN(dateFrom.getTime())) {
                throw APIError.BadRequest("Invalid date_from format");
            }
            filters.date_from = dateFrom;
        }

        if (date_to) {
            const dateTo = new Date(date_to);
            if (isNaN(dateTo.getTime())) {
                throw APIError.BadRequest("Invalid date_to format");
            }
            filters.date_to = dateTo;
        }

        const pagination: any = {};

        // Validate and set limit
        if (limit !== undefined) {
            const limitNum = limit;
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                throw APIError.BadRequest("Limit must be between 1 and 100");
            }
            pagination.limit = limitNum;
        }

        const result = await transactionService.getTransactions(filters, pagination);

        APIResponse.success(
            res,
            "Transactions retrieved successfully",
            result
        )
    }

    async getTransactionById(req: Request, res: Response) {
        const user_id = req.user?.id;
        if (!user_id) {
            throw APIError.Unauthorized("User not authenticated");
        }

        const { id } = req.params;
        const transactionId = parseInt(id as string);

        if (isNaN(transactionId)) {
            throw APIError.BadRequest("Invalid transaction ID");
        }

        const transaction = await transactionService.getTransactionById(transactionId, user_id);

        APIResponse.success(
            res,
            "Transaction details retrieved successfully",
            transaction
        )
    }
}

export const transactionController = new TransactionController();