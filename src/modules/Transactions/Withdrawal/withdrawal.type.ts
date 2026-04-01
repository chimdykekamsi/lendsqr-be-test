import z from "zod";

export interface WithdrawFundsDTO {
    bank_account_id: string;
    transaction_id: number;
    wallet_id: number;
}

export enum WithdrawalProcessingStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SETTLED = "SETTLED",
    FAILED = "FAILED",
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

export const initiateWithdrawalSchema = z.object({
    amount: z.number().positive(),
    bankAccountDetails: z.string(),
    description: z.string().max(200).optional()
});

export const confirmWithdrawalSchema = z.object({
    reference: z.string(),
    success: z.coerce.boolean()
})