// types/express.d.ts
import { Restaurant } from "@/generated/prisma/client";
import { RestaurantGetPayload } from "@/generated/prisma/models";
import { AdminPayload } from "@/modules/Admin/admin.type";
import { OwnerPayload, StaffPayload, UserPayload } from "@/modules/Auth/auth.types";
import { RestaurantWithRelations } from "@/modules/Restaurant/restaurant.types";

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
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

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum TransactionType {
    FUNDING = "FUNDING",
    TRANSFER = "TRANSFER",
    WITHDRAWAL = "WITHDRAWAL",
}

export enum TransactionStatus {
    PENDING = "PENDING",
    SUCCESSFUL = "SUCCESSFUL",
    FAILED = "FAILED"
}

export enum EntryType {
    CREDIT = "CREDIT",
    DEBIT = "DEBIT",
}

export enum WalletType {
    MAIN = "MAIN",
    HOLDING = "HOLDING",
    FEE = "FEE",
    SYSTEM = "SYSTEM"
}

export enum WithdrawalProcessingStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    SETTLED = "SETTLED",
    FAILED = "FAILED",
}

// ─── Database Row Types ──────────────────────────────────────────────────────

export interface UserRow {
    id: number;
    email: string;
    name: string;
    phone: string | null;
    blacklisted: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface WalletRow {
    id: number;
    user_id: number;
    wallet_type: WalletType;
    balance: number;
    created_at: Date;
    updated_at: Date;
}

export interface TransactionRow {
    id: number;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    reference: string;
    parent_transaction_id: number | null;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface LedgerEntryRow {
    id: number;
    wallet_id: number;
    transaction_id: number;
    entry_type: EntryType;
    amount: number;
    balance_before: number;
    balance_after: number;
    created_at: Date;
}

export interface FundingRow {
    id: number;
    transaction_id: number;
    wallet_id: number;
    payment_reference: string | null;
    provider: string | null;
    created_at: Date;
}

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

export interface CreateUserDTO {
    name: string;
    email: string;
    phone?: string;
}

export interface FundWalletDTO {
    amount: number; // in kobo
    payment_reference?: string;
    provider?: string;
}

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
