export interface WithdrawalRow {
    id: number;
    transaction_id: number;
    wallet_id: number;
    bank_account_details: string; // JSON string or something
    provider: string;
    created_at: Date;
    updated_at: Date;
}

export interface CreateWithdrawalDTO {
    transaction_id: number;
    wallet_id: number;
    bank_account_details: string;
    provider: string;
}