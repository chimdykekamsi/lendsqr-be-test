declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number,
                email: string
            };
            idempotencyKey?: string;
        }
    }
}

// Type for paginated response
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        nextPage: string | null;
        prevPage: string | null;
    };
}

export enum WithdrawalProcessingStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SETTLED = "SETTLED",
    FAILED = "FAILED",
}

// ─── Database Row Types ──────────────────────────────────────────────────────


export interface TransferRow {
    id: number;
    transaction_id: number;
    sender_wallet_id: number;
    receiver_wallet_id: number;
    created_at: Date;
}

export interface WithdrawalRow {
    id: number;
    transaction_id: number;
    wallet_id: number;
    bank_account_id: string;
    settlement_reference: string | null;
    processing_status: WithdrawalProcessingStatus;
    failure_reason: string | null;
    created_at: Date;
}

// ─── Request / Response DTOs ─────────────────────────────────────────────────

export interface TransferFundsDTO {
    receiver_email: string;
    amount: number; // in kobo
    description?: string;
}

export interface WithdrawFundsDTO {
    amount: number; // in kobo
    bank_account_id: string;
    description?: string;
}
