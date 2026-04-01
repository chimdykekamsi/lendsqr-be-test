import { formatAmount } from "@/utils/helpers";
import { transactionService } from "./transaction.service";
import z from "zod";

export enum Currency {
    NGN = "NGN"
}

export const CURRENCY_CONFIG: Record<Currency, { symbol: string; decimal_places: number, multiplier: number }> = {
    NGN: { symbol: "₦", decimal_places: 2, multiplier: 100 }
}

export enum TransactionType {
    FUNDING = "FUNDING",
    TRANSFER = "TRANSFER",
    WITHDRAWAL = "WITHDRAWAL",
    REVERSAL = "REVERSAL",
}

export enum TransactionStatus {
    PENDING = "PENDING",
    SUCCESSFUL = "SUCCESSFUL",
    FAILED = "FAILED"
}

export interface TransactionRow {
    id: number;
    user_id: number;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    reference: string;
    parent_transaction_id: number | null;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateTransactionDTO {
    type: TransactionType;
    amount: number;
    user_id: number;
    reference: string;
    parent_transaction_id?: number;
    description?: string;
    status?: TransactionStatus
}

export const TransactionQuerySchema = z.object({
    transaction_type: z.enum(TransactionType).optional(),
    status: z.enum(TransactionStatus).optional(),
    amount_min: z.coerce.number().optional(),
    amount_max: z.coerce.number().optional(),
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    limit: z.coerce.number().optional(),
    page: z.coerce.number().optional()
})