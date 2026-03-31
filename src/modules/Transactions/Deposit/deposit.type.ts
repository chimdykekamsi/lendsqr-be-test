import z from "zod";

export interface FundingRow {
    id: number;
    transaction_id: number;
    wallet_id: number;
    payment_reference: string | null;
    provider: string | null;
    created_at: Date;
}

export const initiateDepositSchema = z.object({
    amount: z.number().positive("Amount must be a positive number"),
    description: z.string().optional(),
})

export interface FundingRow {
    id: number;
    transaction_id: number;
    wallet_id: number;
    payment_reference: string | null;
    provider: string | null;
    created_at: Date;
}

export interface CreateFundingDTO {
    transaction_id: number;
    wallet_id: number;
    payment_reference?: string;
    provider?: string;
}

export const confirmDepositDto = z.object({
    reference: z.string().nonempty("Reference is required")
});