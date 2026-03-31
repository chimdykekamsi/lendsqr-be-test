export interface CreateLedgerEntryDTO {
    wallet_id: number;
    transaction_id: number;
    entry_type: EntryType;
    amount: number;
    balance_before: number;
    balance_after: number;
}

export enum EntryType {
    CREDIT = "CREDIT",
    DEBIT = "DEBIT",
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