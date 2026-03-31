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
}