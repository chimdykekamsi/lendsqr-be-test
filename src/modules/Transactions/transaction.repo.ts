import db from "@/configs/db";
import { Knex } from "knex";
import { CreateTransactionDTO, TransactionRow, TransactionStatus } from "./transaction.type";

export class TransactionRepository {
    private readonly table = "transactions";

    async findByReference(reference: string, database: Knex | Knex.Transaction = db): Promise<TransactionRow | undefined> {
        return database<TransactionRow>(this.table).where({ reference }).first();
    }

    async create(dto: CreateTransactionDTO, database: Knex | Knex.Transaction = db): Promise<TransactionRow["id"] | null> {
        const { type, amount, reference, parent_transaction_id, description, user_id } = dto;
        const [id] = await database<TransactionRow>(this.table).insert({
            type,
            amount,
            user_id,
            reference,
            parent_transaction_id: parent_transaction_id || null,
            description: description || null,
            status: TransactionStatus.PENDING,
            created_at: new Date(),
            updated_at: new Date(),
        });
        return id || null;
    }

    async findById(id: number, database: Knex | Knex.Transaction = db): Promise<TransactionRow | null> {
        const transaction = await database<TransactionRow>(this.table).where({ id }).first();
        return transaction ?? null;
    }

    async updateStatus(id: number, status: TransactionStatus, database: Knex | Knex.Transaction = db): Promise<TransactionRow["id"] | undefined> {
        return database<TransactionRow>(this.table)
            .where({ id })
            .update({ status, updated_at: new Date() });
    }
}

export const transactionRepository = new TransactionRepository();