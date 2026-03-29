
export enum IdempotencyStatus {
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

export interface IdempotencyKeyRow {
    id: number;
    user_id: number;
    key: string;
    request_hash: string | null;
    response: string | null;
    status: IdempotencyStatus;
    created_at: Date;
    expires_at: Date;
}