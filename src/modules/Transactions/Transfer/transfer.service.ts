import db from "@/configs/db";
import { transactionService } from "../transaction.service";
import { Currency, CURRENCY_CONFIG, TransactionType, TransactionRow, TransactionStatus } from "../transaction.type";
import { generateReference } from "@/utils/helpers";
import { walletService } from "../../Wallet/wallet.service";
import { APIError } from "@/utils/APIError";
import { ledgerService } from "../../Ledger/ledger.service";
import { TransferRow, CreateTransferDTO } from "./transfer.type";
import { transferRepository } from "./transfer.repo";

export class TransferService {
    private readonly transactionType = TransactionType.TRANSFER;
    private readonly currencyConfig = CURRENCY_CONFIG[Currency.NGN];
    private readonly repository = transferRepository;

    async initiateTransfer(
        sender_user_id: number,
        receiver_user_id: number,
        amount: number,
        description?: string
    ): Promise<{ transaction: TransactionRow; transfer: TransferRow }> {
        const transactionAmount = Math.round(amount * this.currencyConfig.multiplier);

        // Prevent self-transfer
        if (sender_user_id === receiver_user_id) {
            throw APIError.BadRequest("Cannot transfer to yourself");
        }

        return db.transaction(async (trx) => {
            // Get sender's wallet
            const senderWallet = await walletService.findByUserIdRaw(sender_user_id, trx);
            if (!senderWallet) {
                throw APIError.NotFound("Sender wallet not found");
            }

            // Get receiver's wallet
            const receiverWallet = await walletService.findByUserIdRaw(receiver_user_id, trx);
            if (!receiverWallet) {
                throw APIError.NotFound("Receiver wallet not found");
            }

            // Check if sender has sufficient balance
            if (senderWallet.balance < transactionAmount) {
                throw APIError.BadRequest("Insufficient balance");
            }

            // Create the transaction
            const transaction = await transactionService.createTransaction({
                type: this.transactionType,
                user_id: sender_user_id,
                amount: transactionAmount,
                status: TransactionStatus.SUCCESSFUL,
                reference: generateReference("TRF"),
                description: description || `Transfer to user ${receiver_user_id}`,
            }, trx);

            // Get current balances
            const senderBalanceBefore = senderWallet.balance;
            const receiverBalanceBefore = receiverWallet.balance;

            // Perform the transfer: debit sender, credit receiver
            await walletService.decrementBalance(senderWallet.id, transaction.amount, trx);
            await walletService.incrementBalance(receiverWallet.id, transaction.amount, trx);

            // Create ledger entries
            await ledgerService.createDoubleEntry(
                transaction.id,
                transaction.amount,
                {
                    walletId: receiverWallet.id,
                    balanceBefore: receiverBalanceBefore,
                    balanceAfter: receiverBalanceBefore + transaction.amount,
                },
                {
                    walletId: senderWallet.id,
                    balanceBefore: senderBalanceBefore,
                    balanceAfter: senderBalanceBefore - transaction.amount,
                },
                trx
            );

            // Create transfer record
            const transferId = await this.repository.create({
                transaction_id: transaction.id,
                sender_wallet_id: senderWallet.id,
                receiver_wallet_id: receiverWallet.id,
            }, trx);

            if (!transferId) throw APIError.Internal("Failed to create transfer record");

            const transfer = await this.repository.findById(transferId, trx);
            if (!transfer) {
                throw APIError.Internal("Failed to retrieve transfer record");
            }

            return { transaction: transactionService.sanitize(transaction), transfer };
        });
    }
}

export const transferService = new TransferService();