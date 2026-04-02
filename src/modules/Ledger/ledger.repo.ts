import db from "@/configs/db";
import { Knex } from "knex";
import { LedgerEntryRow, CreateLedgerEntryDTO } from "./ledger.type";

export class LedgerRepository {
    private readonly table = "ledger_entries";

    async create(dto: CreateLedgerEntryDTO, database: Knex | Knex.Transaction = db): Promise<LedgerEntryRow["id"] | null> {
        const { wallet_id, transaction_id, entry_type, amount, balance_before, balance_after } = dto;
        const [id] = await database<LedgerEntryRow>(this.table).insert({
            wallet_id,
            transaction_id,
            entry_type,
            amount,
            balance_before,
            balance_after,
            created_at: new Date(),
        });
        return id || null;
    }
}

export const ledgerRepository = new LedgerRepository();