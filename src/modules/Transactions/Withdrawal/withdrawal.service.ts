import db from "@/configs/db";
import { transactionService } from "../transaction.service";
import { Currency, CURRENCY_CONFIG, TransactionType, TransactionRow, TransactionStatus } from "../transaction.type";
import { generateReference } from "@/utils/helpers";
import { walletService } from "../../Wallet/wallet.service";
import { WalletType } from "../../Wallet/wallet.type";
import { APIError } from "@/utils/APIError";
import { ledgerService } from "../../Ledger/ledger.service";
import { transactionRepository } from "../transaction.repo";
import { WithdrawalRow, CreateWithdrawalDTO } from "./withdrawal.type";
import { withdrawalRepository } from "./withdrawal.repo";

export class WithdrawalService {
    private readonly transactionType = TransactionType.WITHDRAWAL;
    private readonly currencyConfig = CURRENCY_CONFIG[Currency.NGN];
    private readonly repository = withdrawalRepository;

    async initiateWithdrawal(
        user_id: number,
        amount: number,
        bankAccountDetails: string,
        description?: string
    ): Promise<{ transaction: TransactionRow; withdrawal: WithdrawalRow }> {
        const transactionAmount = Math.round(amount * this.currencyConfig.multiplier);

        return db.transaction(async (trx) => {
            // Get the user's MAIN wallet
            const userWallet = await walletService.findByUserIdRaw(user_id, trx);
            if (!userWallet) {
                throw APIError.NotFound("User wallet not found");
            }

            // Check if user has sufficient balance
            if (userWallet.balance < transactionAmount) {
                throw APIError.BadRequest("Insufficient balance");
            }

            // Get or create HOLDING system wallet
            let holdingWallet = await walletService.findSystemWallet(WalletType.HOLDING, trx);
            if (!holdingWallet) {
                holdingWallet = await walletService.createSystemWallet(WalletType.HOLDING, trx);
            }

            // Create the transaction
            const transaction = await transactionService.createTransaction({
                type: this.transactionType,
                user_id,
                amount: transactionAmount,
                reference: generateReference("WD"),
                description: description || "Wallet withdrawal",
            }, trx);

            // Get current balances
            const userBalanceBefore = userWallet.balance;
            const holdingBalanceBefore = holdingWallet.balance;

            // Debit user wallet, credit holding wallet
            await walletService.decrementBalance(userWallet.id, transaction.amount, trx);
            await walletService.incrementBalance(holdingWallet.id, transaction.amount, trx);

            // Create ledger entries
            await ledgerService.createDoubleEntry(
                holdingWallet.id, // credit holding wallet
                userWallet.id, // debit user wallet
                transaction.id,
                transaction.amount,
                holdingBalanceBefore,
                holdingBalanceBefore + transaction.amount,
                userBalanceBefore,
                userBalanceBefore - transaction.amount,
                trx
            );

            // Create withdrawal record
            const withdrawalId = await this.repository.create({
                transaction_id: transaction.id,
                wallet_id: userWallet.id,
                bank_account_details: bankAccountDetails,
                provider: "MockBank",
            }, trx);

            if (!withdrawalId) throw APIError.Internal("Failed to create withdrawal record");

            const withdrawal = await this.repository.findById(withdrawalId, trx);
            if (!withdrawal) {
                throw APIError.Internal("Failed to retrieve withdrawal record");
            }

            return { transaction, withdrawal };
        });
    }

    async confirmWithdrawal(reference: string, success: boolean): Promise<{ transaction: TransactionRow; reversalTransaction?: TransactionRow }> {
        return db.transaction(async (trx) => {
            // Find the transaction by reference
            const transaction = await transactionRepository.findByReference(reference, trx);
            if (!transaction) {
                throw APIError.NotFound("Transaction not found");
            }

            if (transaction.status !== TransactionStatus.PENDING) {
                throw APIError.Conflict("Transaction is not in pending state");
            }

            if (success) {
                // Update transaction status to SUCCESSFUL
                const updatedTransaction = await transactionService.updateTransactionStatus(transaction.id, TransactionStatus.SUCCESSFUL, trx);

                // Get the holding wallet
                const holdingWallet = await walletService.findSystemWallet(WalletType.HOLDING, trx);
                if (!holdingWallet) {
                    throw APIError.Internal("Holding wallet not found");
                }

                // Get the system wallet
                const systemWallet = await walletService.findSystemWallet(WalletType.SYSTEM, trx);
                if (!systemWallet) {
                    throw APIError.Internal("System wallet not found");
                }

                // Get current balances
                const holdingBalanceBefore = holdingWallet.balance;
                const systemBalanceBefore = systemWallet.balance;

                // Debit holding wallet, credit system wallet
                await walletService.decrementBalance(holdingWallet.id, transaction.amount, trx);
                await walletService.incrementBalance(systemWallet.id, transaction.amount, trx);

                // Create ledger entries
                await ledgerService.createDoubleEntry(
                    systemWallet.id, // credit system wallet
                    holdingWallet.id, // debit holding wallet
                    transaction.id,
                    transaction.amount,
                    systemBalanceBefore,
                    systemBalanceBefore + transaction.amount,
                    holdingBalanceBefore,
                    holdingBalanceBefore - transaction.amount,
                    trx
                );

                return { transaction: updatedTransaction };
            } else {
                // Create reversal transaction
                const reversalTransaction = await transactionService.createTransaction({
                    type: TransactionType.REVERSAL,
                    user_id: transaction.user_id!,
                    amount: transaction.amount,
                    reference: generateReference("REV"),
                    parent_transaction_id: transaction.id,
                    description: `Reversal for failed withdrawal ${transaction.reference}`,
                }, trx);

                // Update original transaction to FAILED
                await transactionService.updateTransactionStatus(transaction.id, TransactionStatus.FAILED, trx);

                // Get the holding wallet
                const holdingWallet = await walletService.findSystemWallet(WalletType.HOLDING, trx);
                if (!holdingWallet) {
                    throw APIError.Internal("Holding wallet not found");
                }

                // Get the user's wallet
                const userWallet = await walletService.findByUserIdRaw(transaction.user_id!, trx);
                if (!userWallet) {
                    throw APIError.NotFound("User wallet not found");
                }

                // Get current balances
                const holdingBalanceBefore = holdingWallet.balance;
                const userBalanceBefore = userWallet.balance;

                // Debit holding wallet, credit user wallet
                await walletService.decrementBalance(holdingWallet.id, transaction.amount, trx);
                await walletService.incrementBalance(userWallet.id, transaction.amount, trx);

                // Create ledger entries for reversal
                await ledgerService.createDoubleEntry(
                    userWallet.id, // credit user wallet
                    holdingWallet.id, // debit holding wallet
                    reversalTransaction.id,
                    transaction.amount,
                    userBalanceBefore,
                    userBalanceBefore + transaction.amount,
                    holdingBalanceBefore,
                    holdingBalanceBefore - transaction.amount,
                    trx
                );

                return { transaction: await transactionRepository.findById(transaction.id, trx)!, reversalTransaction };
            }
        });
    }
}

export const withdrawalService = new WithdrawalService();