import { Knex } from "knex";
import db from "@/configs/db";
import { WithdrawalRow, WithdrawFundsDTO } from "./withdrawal.type";

export class WithdrawalRepository {
    private readonly tableName = "withdrawals";

    async create(dto: WithdrawFundsDTO, database: Knex | Knex.Transaction = db): Promise<number> {
        const [id] = await database(this.tableName).insert(dto).returning("id");
        return id;
    }

    async findById(id: number, database: Knex | Knex.Transaction = db): Promise<WithdrawalRow | null> {
        return database(this.tableName).where({ id }).first();
    }

    async findByTransactionId(transactionId: number, database: Knex | Knex.Transaction = db): Promise<WithdrawalRow | null> {
        return database(this.tableName).where({ transaction_id: transactionId }).first();
    }
}

export const withdrawalRepository = new WithdrawalRepository();