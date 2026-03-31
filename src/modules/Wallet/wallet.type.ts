
export enum WalletType {
    MAIN = "MAIN",
    HOLDING = "HOLDING",
    FEE = "FEE",
    SYSTEM = "SYSTEM"
}

export interface WalletRow {
    id: number;
    user_id: number;
    wallet_type: WalletType;
    balance: number;
    created_at: Date;
    updated_at: Date;
}