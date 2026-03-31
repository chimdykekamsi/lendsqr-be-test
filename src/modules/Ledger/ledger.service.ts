import db from "@/configs/db";
import { Knex } from "knex";
import { ledgerRepository } from "./ledger.repo";
import { CreateLedgerEntryDTO, EntryType } from "./ledger.type";

export class LedgerService {
    private readonly repository = ledgerRepository;

    async createEntry(dto: CreateLedgerEntryDTO, database: Knex | Knex.Transaction = db): Promise<void> {
        await this.repository.create(dto, database);
    }

    async createDoubleEntry(
        creditWalletId: number,
        debitWalletId: number,
        transactionId: number,
        amount: number,
        creditBalanceBefore: number,
        creditBalanceAfter: number,
        debitBalanceBefore: number,
        debitBalanceAfter: number,
        database: Knex | Knex.Transaction = db
    ): Promise<void> {
        // Create credit entry
        await this.createEntry({
            wallet_id: creditWalletId,
            transaction_id: transactionId,
            entry_type: EntryType.CREDIT,
            amount,
            balance_before: creditBalanceBefore,
            balance_after: creditBalanceAfter,
        }, database);

        // Create debit entry
        await this.createEntry({
            wallet_id: debitWalletId,
            transaction_id: transactionId,
            entry_type: EntryType.DEBIT,
            amount,
            balance_before: debitBalanceBefore,
            balance_after: debitBalanceAfter,
        }, database);
    }
}

export const ledgerService = new LedgerService();