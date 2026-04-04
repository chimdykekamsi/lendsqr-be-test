import db from "@/configs/db";
import { transactionService } from "../transaction.service";
import { Currency, CURRENCY_CONFIG, TransactionType, TransactionRow, TransactionStatus } from "../transaction.type";
import { generateReference } from "@/utils/helpers";
import { walletService } from "../../Wallet/wallet.service";
import { WalletRow, WalletType } from "../../Wallet/wallet.type";
import { APIError } from "@/utils/APIError";
import { ledgerService } from "../../Ledger/ledger.service";
import { TransferRow, CreateTransferDTO } from "./transfer.type";
import { transferRepository } from "./transfer.repo";

export class TransferService {
    private readonly currencyConfig = CURRENCY_CONFIG[Currency.NGN];
    private readonly repository = transferRepository;

    async initiateTransfer(
        sender_user_id: number,
        receiver_user_id: number,
        amount: number,
        description?: string
    ): Promise<{
        senderTransaction: TransactionRow;
        receiverTransaction: TransactionRow;
        transfer: TransferRow
    }> {
        const transactionAmount = Math.round(amount * this.currencyConfig.multiplier);

        // Prevent self-transfer
        if (sender_user_id === receiver_user_id) {
            throw APIError.BadRequest("Cannot transfer to yourself");
        }

        return db.transaction(async (trx) => {
            // Lock User Wallets only (Sorted to prevent P2P deadlocks)
            const userIds = [sender_user_id, receiver_user_id].sort((a, b) => a - b);
            const lockedWallets = await trx<WalletRow>("wallets")
                .whereIn("user_id", userIds)
                .forUpdate();

            // Get sender's wallet
            const senderWallet = lockedWallets.find(w => w.user_id === sender_user_id);
            if (!senderWallet) {
                throw APIError.NotFound("Sender wallet not found");
            }

            const receiverWallet = lockedWallets.find(w => w.user_id === receiver_user_id);
            if (!receiverWallet) {
                throw APIError.NotFound("Receiver wallet not found");
            }

            // Check if sender has sufficient balance
            if (senderWallet.balance < transactionAmount) {
                throw APIError.BadRequest("Insufficient balance");
            }

            // Get or create HOLDING wallet for intermediary transfer
            const holdingWallet = await walletService.findSystemWallet(WalletType.HOLDING, trx);
            if (!holdingWallet) {
                throw APIError.Internal("Holding wallet not found");
            }

            // Get balances for ledger entries
            const senderBalanceBefore = senderWallet.balance;
            const receiverBalanceBefore = receiverWallet.balance;
            const holdingBalanceBefore = holdingWallet.balance;

            // Perform the transfer via holding wallet:
            // 1. Debit sender's wallet, credit holding wallet (WITHDRAWAL leg)
            await walletService.decrementBalance(senderWallet.id, transactionAmount, trx);
            await walletService.incrementBalance(holdingWallet.id, transactionAmount, trx);

            // Create TRANSFER transaction for sender (money leaving sender's wallet)
            const withdrawalTransaction = await transactionService.createTransaction({
                type: TransactionType.TRANSFER,
                user_id: sender_user_id,
                amount: transactionAmount,
                status: TransactionStatus.SUCCESSFUL,
                reference: generateReference("TRF-WD"),
                description: description || `Transfer to user ${receiver_user_id}`,
            }, trx);

            // Create FUNDING transaction for receiver (money entering receiver's wallet)
            const fundingTransaction = await transactionService.createTransaction({
                type: TransactionType.FUNDING,
                user_id: receiver_user_id,
                amount: transactionAmount,
                status: TransactionStatus.SUCCESSFUL,
                reference: generateReference("TRF-FD"),
                description: description || `Transfer from user ${sender_user_id}`,
            }, trx);

            // Create ledger entries for WITHDRAWAL transaction
            await ledgerService.createDoubleEntry(
                withdrawalTransaction.id,
                transactionAmount,
                {
                    walletId: holdingWallet.id,
                    balanceBefore: holdingBalanceBefore,
                    balanceAfter: holdingBalanceBefore + transactionAmount,
                },
                {
                    walletId: senderWallet.id,
                    balanceBefore: senderBalanceBefore,
                    balanceAfter: senderBalanceBefore - transactionAmount,
                },
                trx
            );

            // 2. Debit holding wallet, credit receiver's wallet (FUNDING leg)
            await walletService.decrementBalance(holdingWallet.id, transactionAmount, trx);
            await walletService.incrementBalance(receiverWallet.id, transactionAmount, trx);

            // Create ledger entries for FUNDING transaction
            await ledgerService.createDoubleEntry(
                fundingTransaction.id,
                transactionAmount,
                {
                    walletId: receiverWallet.id,
                    balanceBefore: receiverBalanceBefore,
                    balanceAfter: receiverBalanceBefore + transactionAmount,
                },
                {
                    walletId: holdingWallet.id,
                    balanceBefore: holdingBalanceBefore + transactionAmount,
                    balanceAfter: holdingBalanceBefore,
                },
                trx
            );

            // Create transfer record linking to the withdrawal transaction (as the primary)
            const transferId = await this.repository.create({
                transaction_id: withdrawalTransaction.id,
                sender_wallet_id: senderWallet.id,
                receiver_wallet_id: receiverWallet.id,
            }, trx);

            if (!transferId) throw APIError.Internal("Failed to create transfer record");

            const transfer = await this.repository.findById(transferId, trx);
            if (!transfer) {
                throw APIError.Internal("Failed to retrieve transfer record");
            }

            // Return both transactions for completeness
            return {
                senderTransaction: transactionService.sanitize(withdrawalTransaction),
                receiverTransaction: transactionService.sanitize(fundingTransaction),
                transfer
            };
        });
    }
}

export const transferService = new TransferService();