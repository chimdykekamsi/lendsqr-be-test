import z from "zod";

export interface TransferRow {
    id: number;
    transaction_id: number;
    sender_wallet_id: number;
    receiver_wallet_id: number;
    created_at: Date;
}

export interface CreateTransferDTO {
    transaction_id: number;
    sender_wallet_id: number;
    receiver_wallet_id: number;
}

export const initiateTransferSchema = z.object({
    receiver_id: z.number().positive("Receiver ID must be a positive number"),
    amount: z.number().positive("Amount must be a positive number"),
    description: z.string().optional(),
});