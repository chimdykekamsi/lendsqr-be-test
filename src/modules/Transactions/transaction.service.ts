import { Knex } from "knex";
import { transactionRepository } from "./transaction.repo";
import { CreateTransactionDTO, TransactionRow, TransactionStatus } from "./transaction.type";
import db from "@/configs/db";
import { APIError } from "@/utils/APIError";

export class TransactionService {
    private readonly repository = transactionRepository;

    async createTransaction(dto: CreateTransactionDTO, database: Knex | Knex.Transaction = db) {
        const existingTransaction = await this.repository.findByReference(dto.reference, database);
        if (existingTransaction) {
            throw APIError.Conflict("Transaction with this reference already exists");
        }

        const transactionId = await this.repository.create(dto, database);
        if (!transactionId) {
            throw APIError.Internal("Failed to create transaction");
        }

        const transaction = await this.repository.findById(transactionId, database);
        if (!transaction) {
            throw APIError.Internal("Failed to retrieve created transaction");
        }

        return transaction;
    }

    async updateTransactionStatus(id: number, status: TransactionStatus, database: Knex | Knex.Transaction = db): Promise<TransactionRow> {
        const transaction = await this.repository.updateStatus(id, status, database);
        if (!transaction) throw APIError.Internal("Failed to update transaction status");
        return this.repository.findById(id, database) as Promise<TransactionRow>;
    }
}

export const transactionService = new TransactionService();