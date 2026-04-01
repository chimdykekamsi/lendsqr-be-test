import db from "@/configs/db";
import { Knex } from "knex";
import { ledgerRepository } from "./ledger.repo";
import { CreateLedgerEntryDTO, EntryType } from "./ledger.type";

export class LedgerService {
    private readonly repository = ledgerRepository;

    async createEntry(dto: CreateLedgerEntryDTO, database: Knex | Knex.Transaction = db): Promise<void> {
        await this.repository.create(dto, database);
    }

    /**
     * 
     * @param transactionId 
     * @param amount transaction amount after reduced to lowest currency
     * @param credit credit entry { walletId, balanceBefore, balanceAfter }
     * @param debit debit entry { walletId, balanceBefore, balanceAfter }
     * @param database optional database transaction
     */
    async createDoubleEntry(
        transactionId: number,
        amount: number,
        credit: {
            walletId: number,
            balanceBefore: number,
            balanceAfter: number,
        },
        debit: {
            walletId: number,
            balanceBefore: number,
            balanceAfter: number,
        },
        database: Knex | Knex.Transaction = db
    ): Promise<void> {
        // Create credit entry
        await this.createEntry({
            wallet_id: credit.walletId,
            transaction_id: transactionId,
            entry_type: EntryType.CREDIT,
            amount,
            balance_before: credit.balanceBefore,
            balance_after: credit.balanceAfter,
        }, database);

        // Create debit entry
        await this.createEntry({
            wallet_id: debit.walletId,
            transaction_id: transactionId,
            entry_type: EntryType.DEBIT,
            amount,
            balance_before: debit.balanceBefore,
            balance_after: debit.balanceAfter,
        }, database);
    }
}

export const ledgerService = new LedgerService();