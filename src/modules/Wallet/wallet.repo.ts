import { Knex } from "knex";
import { WalletRow, WalletType } from "./wallet.type";
import db from "@/configs/db";

export class WalletRepository {

    private readonly table = "wallets";

    async create(walletData: { user_id: number; wallet_type: WalletType }, database: Knex | Knex.Transaction = db): Promise<WalletRow["id"] | null> {
        const { user_id, wallet_type } = walletData;
        const [id] = await database(this.table).insert({
            user_id,
            wallet_type,
            balance: 0,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return id || null;
    }

    async findByUserId(user_id: number, database: Knex | Knex.Transaction = db): Promise<WalletRow | undefined> {
        return database<WalletRow>(this.table).where({ user_id }).first();
    }

    async findById(id: number, database: Knex | Knex.Transaction = db): Promise<WalletRow | null> {
        const wallet = await database<WalletRow>(this.table).where({ id }).first();
        return wallet ?? null;
    }

    async findByType(wallet_type: WalletType, database: Knex | Knex.Transaction = db): Promise<WalletRow | null> {
        const wallet = await database<WalletRow>(this.table)
            .where({ wallet_type })
            .first();
        return wallet ?? null;
    }

    async findSystemWallet(wallet_type: WalletType, database: Knex | Knex.Transaction = db): Promise<WalletRow | null> {
        const wallet = await database<WalletRow>(this.table)
            .where({ wallet_type, user_id: null })
            .first();
        return wallet ?? null;
    }

    async incrementBalance(id: number, amount: number, database: Knex | Knex.Transaction = db): Promise<void> {
        await database(this.table)
            .where({ id })
            .increment('balance', amount)
            .update({ updated_at: new Date() });
    }

    async decrementBalance(id: number, amount: number, database: Knex | Knex.Transaction = db): Promise<void> {
        await database(this.table)
            .where({ id })
            .decrement('balance', amount)
            .update({ updated_at: new Date() });
    }
}

export const walletRepository = new WalletRepository();