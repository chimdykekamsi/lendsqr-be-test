import db from "@/configs/db";
import { Knex } from "knex";
import { CreateFundingDTO, FundingRow } from "./deposit.type";

export class DepositRepository {
    private readonly table = "fundings";

    async create(dto: CreateFundingDTO, database: Knex | Knex.Transaction = db): Promise<FundingRow["id"] | null> {
        const { transaction_id, wallet_id, payment_reference, provider } = dto;
        const [id] = await database<FundingRow>(this.table).insert({
            transaction_id,
            wallet_id,
            payment_reference: payment_reference || null,
            provider: provider || "MockPay",
            created_at: new Date(),
        });
        return id || null;
    }

    async findById(transaction_id: number, database: Knex | Knex.Transaction = db): Promise<FundingRow | null> {
        const funding = await database<FundingRow>(this.table).where({ transaction_id }).first();
        return funding ?? null;
    }

    async findByTransactionId(transactionId: number, database: Knex | Knex.Transaction = db): Promise<FundingRow | null> {
        const funding = await database<FundingRow>(this.table).where({ transaction_id: transactionId }).first();
        return funding ?? null;
    }
}

export const depositRepository = new DepositRepository();