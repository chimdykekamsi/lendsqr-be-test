import db from "@/configs/db";
import { transactionService } from "../transaction.service";
import { Currency, CURRENCY_CONFIG, TransactionType, TransactionRow, TransactionStatus } from "../transaction.type";
import { generateReference } from "@/utils/helpers";
import { walletService } from "../../Wallet/wallet.service";
import { WalletType } from "../../Wallet/wallet.type";
import { APIError } from "@/utils/APIError";
import { ledgerService } from "../../Ledger/ledger.service";
import { transactionRepository } from "../transaction.repo";
import { FundingRow } from "./deposit.type";
import { depositRepository } from "./deposit.repo";

export class DepositService {
    private readonly transactionType = TransactionType.FUNDING;
    private readonly currencyConfig = CURRENCY_CONFIG[Currency.NGN]; // Assuming NGN for now
    private readonly repository = depositRepository;

    async initiateDeposit(
        user_id: number,
        amount: number,
        description?: string
    ): Promise<{ transaction: TransactionRow; paymentDetails: unknown }> {
        const transactionAmount = Math.round(amount * this.currencyConfig.multiplier); // Convert to smallest currency unit

        return db.transaction(async (trx) => {
            // Create the transaction
            const transaction = await transactionService.createTransaction({
                type: this.transactionType,
                user_id,
                amount: transactionAmount,
                reference: generateReference("DEP"),
                description: description || "Wallet funding",
            }, trx);

            // Get the user's MAIN wallet
            const wallet = await walletService.findByUserId(user_id, trx);
            if (!wallet) {
                throw APIError.NotFound("User wallet not found");
            }

            // mock payment service to fetch payment details using the transaction reference
            const paymentDetails = {
                payment_reference: `${transaction.reference}`,
                provider: "MockPay",
                paymentUrl: `https://mockpay.com/pay/${transaction.reference}`
            };

            return { transaction: transactionService.sanitize(transaction), paymentDetails };
        });
    }

    async confirmDeposit(reference: string): Promise<{ transaction: TransactionRow; funding: FundingRow }> {
        return db.transaction(async (trx) => {
            // Find the transaction by reference
            const transaction = await transactionRepository.findByReference(reference, trx);
            if (!transaction) {
                throw APIError.NotFound("Transaction not found");
            }

            if (transaction.status !== TransactionStatus.PENDING) {
                throw APIError.Conflict("Transaction is not in pending state");
            }

            // Get the user's wallet
            const userWallet = await walletService.findByUserIdRaw(transaction.user_id!, trx);
            if (!userWallet) {
                throw APIError.NotFound("User wallet not found");
            }

            // Update transaction status to COMPLETED
            const updatedTransaction = await transactionService.updateTransactionStatus(transaction.id, TransactionStatus.SUCCESSFUL, trx);

            // Get the system wallet
            const systemWallet = await walletService.findSystemWallet(WalletType.SYSTEM, trx);
            if (!systemWallet) {
                throw APIError.Internal("System wallet not found");
            }

            // Get current balances
            const userBalanceBefore = userWallet.balance;
            const systemBalanceBefore = systemWallet.balance;

            // Update balances
            await walletService.incrementBalance(userWallet.id, transaction.amount, trx);
            await walletService.decrementBalance(systemWallet.id, transaction.amount, trx);

            const { credit, debit } = {
                credit: {
                    walletId: userWallet.id,
                    balanceBefore: userBalanceBefore,
                    balanceAfter: userBalanceBefore + transaction.amount,
                },
                debit: {
                    walletId: systemWallet.id,
                    balanceBefore: systemBalanceBefore,
                    balanceAfter: systemBalanceBefore - transaction.amount,
                }
            };


            // Create ledger entries
            await ledgerService.createDoubleEntry(
                transaction.id,
                transaction.amount,
                credit,
                debit,
                trx
            );

            // Create funding record
            const fundingId = await this.repository.create({
                transaction_id: transaction.id,
                wallet_id: userWallet.id,
                payment_reference: reference,
                provider: "MockPay",
            }, trx);

            // console.log({ fundingId });
            if (!fundingId) throw APIError.Internal("Failed to create funding record");

            const funding = await this.repository.findByTransactionId(transaction.id, trx);
            // console.log({ funding })
            if (!funding) {
                throw APIError.Internal("Funding record not found");
            }

            return { transaction: transactionService.sanitize(updatedTransaction), funding };
        });
    }
}

export const depositService = new DepositService();