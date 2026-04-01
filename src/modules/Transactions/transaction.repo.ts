import db from "@/configs/db";
import { Knex } from "knex";
import { CreateTransactionDTO, TransactionRow, TransactionStatus, TransactionType } from "./transaction.type";

export interface TransactionFilters {
    user_id?: number;
    type?: TransactionType;
    status?: TransactionStatus;
    amount_min?: number;
    amount_max?: number;
    date_from?: Date;
    date_to?: Date;
}

export interface PaginationOptions {
    limit?: number;
    page?: number;
}

export interface PaginatedTransactions {
    transactions: TransactionRow[];
    pagination: {
        page: number;
        total: number;
        limit: number
    }
}

export class TransactionRepository {
    private readonly table = "transactions";

    async findByReference(reference: string, database: Knex | Knex.Transaction = db): Promise<TransactionRow | undefined> {
        return database<TransactionRow>(this.table).where({ reference }).first();
    }

    async create(dto: CreateTransactionDTO, database: Knex | Knex.Transaction = db): Promise<TransactionRow["id"] | null> {
        const { type, amount, reference, parent_transaction_id, description, user_id, status } = dto;
        const [id] = await database<TransactionRow>(this.table).insert({
            type,
            amount,
            user_id,
            reference,
            parent_transaction_id: parent_transaction_id || null,
            description: description || null,
            status: status || TransactionStatus.PENDING,
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

    async findWithFilters(
        filters: TransactionFilters,
        pagination: PaginationOptions = {},
        database: Knex | Knex.Transaction = db
    ): Promise<PaginatedTransactions> {

        const { limit = 20, page = 1 } = pagination;
        const offset = (page - 1) * limit;

        let baseQuery = database<TransactionRow>(this.table);

        // Apply filters
        if (filters.user_id) {
            baseQuery = baseQuery.where({ user_id: filters.user_id });
        }
        if (filters.type) {
            baseQuery = baseQuery.where({ type: filters.type });
        }
        if (filters.status) {
            baseQuery = baseQuery.where({ status: filters.status });
        }
        if (filters.amount_min) {
            baseQuery = baseQuery.where("amount", ">=", filters.amount_min);
        }
        if (filters.amount_max) {
            baseQuery = baseQuery.where("amount", "<=", filters.amount_max);
        }
        if (filters.date_from) {
            baseQuery = baseQuery.where("created_at", ">=", filters.date_from);
        }
        if (filters.date_to) {
            baseQuery = baseQuery.where("created_at", "<=", filters.date_to);
        }

        // Clone query for count
        const countQuery = baseQuery.clone().count<{ count: number }>("id as count").first();

        // Get paginated results
        const dataQuery = baseQuery
            .clone()
            .select("*")
            .orderBy("created_at", "desc")
            .orderBy("id", "desc")
            .limit(limit)
            .offset(offset);

        const [countResult, transactions] = await Promise.all([
            countQuery,
            dataQuery,
        ]);

        const total = Number(countResult?.count || 0);

        return {
            transactions,
            pagination: {
                page,
                total,
                limit
            }
        };
    }

}

export const transactionRepository = new TransactionRepository();