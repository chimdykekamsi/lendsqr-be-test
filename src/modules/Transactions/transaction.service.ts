import { Knex } from "knex";
import { transactionRepository, TransactionFilters, PaginationOptions, PaginatedTransactions } from "./transaction.repo";
import { CreateTransactionDTO, Currency, CURRENCY_CONFIG, TransactionRow, TransactionStatus } from "./transaction.type";
import db from "@/configs/db";
import { APIError } from "@/utils/APIError";
import { formatAmount } from "@/utils/helpers";
import { withdrawalRepository } from "./Withdrawal/withdrawal.repo";
import { depositRepository } from "./Deposit/deposit.repo";
import { transferRepository } from "./Transfer/transfer.repo";
import { walletRepository } from "../Wallet/wallet.repo";
import { userRepository } from "../User/user.repo";

export class TransactionService {
    private readonly repository = transactionRepository;
    private currencyConfig = CURRENCY_CONFIG[Currency.NGN];

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

    async getTransactions(
        filters: TransactionFilters,
        pagination: PaginationOptions = {},
        database: Knex | Knex.Transaction = db
    ): Promise<PaginatedTransactions> {
        const result = await this.repository.findWithFilters(filters, pagination, database);

        // Sanitize amounts
        result.transactions = result.transactions.map(transaction => this.sanitize(transaction));

        return result;
    }

    async getTransactionById(id: number, userId?: number, database: Knex | Knex.Transaction = db): Promise<any> {
        const transaction = await this.repository.findById(id, database);
        if (!transaction) {
            throw APIError.NotFound("Transaction not found");
        }

        // Check if user has access to this transaction
        if (userId && transaction.user_id !== userId) {
            throw APIError.Forbidden("Access denied");
        }

        const sanitizedTransaction = this.sanitize(transaction);

        // Get detailed information based on transaction type
        const details = await this.getTransactionDetails(transaction, database);

        return {
            ...sanitizedTransaction,
            details
        };
    }

    private async getTransactionDetails(transaction: TransactionRow, database: Knex | Knex.Transaction = db): Promise<any> {
        switch (transaction.type) {
            case 'FUNDING':
                return this.getFundingDetails(transaction.id, database);
            case 'WITHDRAWAL':
                return this.getWithdrawalDetails(transaction.id, database);
            case 'TRANSFER':
                return this.getTransferDetails(transaction.id, database);
            case 'REVERSAL':
                return this.getReversalDetails(transaction.id, database);
            default:
                return null;
        }
    }

    private async getFundingDetails(transactionId: number, database: Knex | Knex.Transaction = db): Promise<any> {
        const funding = await depositRepository.findByTransactionId(transactionId, database);
        return funding ? {
            payment_reference: funding.payment_reference,
            provider: funding.provider,
            type: 'funding'
        } : null;
    }

    private async getWithdrawalDetails(transactionId: number, database: Knex | Knex.Transaction = db): Promise<any> {
        const withdrawal = await withdrawalRepository.findByTransactionId(transactionId, database);
        return withdrawal ? {
            bank_account_details: withdrawal.bank_account_id,
            type: 'withdrawal'
        } : null;
    }

    private async getTransferDetails(transactionId: number, database: Knex | Knex.Transaction = db): Promise<any> {
        const transfer = await transferRepository.findByTransactionId(transactionId, database);

        if (!transfer) return null;

        // Get receiver information
        const receiverWallet = await walletRepository.findById(transfer.receiver_wallet_id, database);

        if (!receiverWallet) return null;

        const receiver = await userRepository.findById(receiverWallet.user_id!, database);

        return {
            receiver: receiver ? {
                id: receiver.id,
                name: receiver.name,
                email: receiver.email
            } : null,
            type: 'transfer'
        };
    }

    private async getReversalDetails(transactionId: number, database: Knex | Knex.Transaction = db): Promise<any> {
        const transaction = await this.repository.findById(transactionId, database);
        if (!transaction?.parent_transaction_id) return null;

        const parentTransaction = await this.repository.findById(transaction.parent_transaction_id, database);
        return parentTransaction ? {
            original_transaction: {
                id: parentTransaction.id,
                type: parentTransaction.type,
                reference: parentTransaction.reference
            },
            type: 'reversal'
        } : null;
    }

    sanitize(transaction: TransactionRow): TransactionRow {
        transaction.amount = formatAmount(transaction.amount, this.currencyConfig)
        return transaction;
    }
}

export const transactionService = new TransactionService();