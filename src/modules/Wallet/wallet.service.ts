import db from "@/configs/db";
import { WalletRow, WalletType } from "./wallet.type";
import { Knex } from "knex";
import { walletRepository } from "./wallet.repo";
import { Currency, CURRENCY_CONFIG } from "../Transactions/transaction.type";

export class WalletService {
    private readonly repository = walletRepository;
    private readonly currencyConfig = CURRENCY_CONFIG[Currency.NGN]

    async createWallet(
        user_id: number,
        wallet_type: WalletType,
        database: Knex | Knex.Transaction = db
    ): Promise<WalletRow> {

        const id = await this.repository.create({ user_id, wallet_type }, database);
        if (!id) {
            throw new Error("Failed to create wallet");
        }

        const wallet = await this.repository.findById(id, database);

        return wallet!;
    }

    async findByUserId(
        user_id: number,
        database: Knex | Knex.Transaction = db
    ): Promise<WalletRow> {
        const wallet = await this.repository.findByUserId(user_id, database);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        wallet.balance = Number((wallet.balance / this.currencyConfig.multiplier).toFixed(this.currencyConfig.decimal_places));
        return wallet;
    }

    async findByUserIdRaw(
        user_id: number,
        database: Knex | Knex.Transaction = db
    ): Promise<WalletRow> {
        const wallet = await this.repository.findByUserId(user_id, database);
        if (!wallet) {
            throw new Error("Wallet not found");
        }
        return wallet;
    }

    async incrementBalance(
        id: number,
        amount: number,
        database: Knex | Knex.Transaction = db
    ): Promise<void> {
        return this.repository.incrementBalance(id, amount, database);
    }

    async findSystemWallet(wallet_type: WalletType, database: Knex | Knex.Transaction = db): Promise<WalletRow | null> {
        return this.repository.findSystemWallet(wallet_type, database);
    }

    async decrementBalance(
        id: number,
        amount: number,
        database: Knex | Knex.Transaction = db
    ): Promise<void> {
        return this.repository.decrementBalance(id, amount, database);
    }
}

export const walletService = new WalletService();