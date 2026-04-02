import { Knex } from "knex";
import db from "@/configs/db";
import { TransferRow, CreateTransferDTO } from "./transfer.type";

export class TransferRepository {
    private readonly tableName = "transfers";

    async create(dto: CreateTransferDTO, database: Knex | Knex.Transaction = db): Promise<number> {
        const [id] = await database(this.tableName).insert(dto).returning("id");
        return id;
    }

    async findById(id: number, database: Knex | Knex.Transaction = db): Promise<TransferRow | null> {
        return database(this.tableName).where({ id }).first();
    }

    async findByTransactionId(transactionId: number, database: Knex | Knex.Transaction = db): Promise<TransferRow | null> {
        return database(this.tableName).where({ transaction_id: transactionId }).first();
    }
}

export const transferRepository = new TransferRepository();