import { withdrawalService } from "@/modules/Transactions/Withdrawal/withdrawal.service";
import { transactionService } from "@/modules/Transactions/transaction.service";
import { walletService } from "@/modules/Wallet/wallet.service";
import { ledgerService } from "@/modules/Ledger/ledger.service";
import { transactionRepository } from "@/modules/Transactions/transaction.repo";
import { withdrawalRepository } from "@/modules/Transactions/Withdrawal/withdrawal.repo";
import { APIError } from "@/utils/APIError";
import db from "@/configs/db";
import { Currency, CURRENCY_CONFIG, TransactionType, TransactionStatus } from "@/modules/Transactions/transaction.type";
import { WalletType } from "@/modules/Wallet/wallet.type";

// Mock dependencies
jest.mock("@/modules/Transactions/transaction.service");
jest.mock("../../Wallet/wallet.service");
jest.mock("../../Ledger/ledger.service");
jest.mock("../transaction.repo");
jest.mock("./withdrawal.repo");
jest.mock("@/configs/db");

describe("WithdrawalService", () => {
    const mockUserId = 1;
    const mockAmount = 5000; // 50 NGN in smallest currency unit
    const mockBankAccountDetails = "Test Bank Account";
    const mockDescription = "Test withdrawal";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("initiateWithdrawal", () => {
        it("should initiate a withdrawal successfully", async () => {
            // Mock walletService.findByUserIdRaw
            const mockUserWallet = {
                id: 1,
                user_id: mockUserId,
                wallet_type: WalletType.MAIN,
                balance: 10000, // 100 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);

            // Mock walletService.findSystemWallet for HOLDING wallet
            const mockHoldingWallet = {
                id: 2,
                user_id: null,
                wallet_type: WalletType.HOLDING,
                balance: 50000, // 500 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            // Mock transactionService.createTransaction
            const mockTransaction = {
                id: 1,
                type: TransactionType.WITHDRAWAL,
                user_id: mockUserId,
                amount: mockAmount,
                status: TransactionStatus.PENDING,
                reference: "WD-123456",
                description: mockDescription,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock withdrawalRepository.create
            (withdrawalRepository.create as jest.Mock).mockResolvedValue(1);

            // Mock withdrawalRepository.findById
            const mockWithdrawal = {
                id: 1,
                transaction_id: 1,
                wallet_id: 1,
                bank_account_id: mockBankAccountDetails,
                created_at: new Date(),
                updated_at: new Date()
            };
            (withdrawalRepository.findById as jest.Mock).mockResolvedValue(mockWithdrawal);

            // Mock ledgerService.createDoubleEntry
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act
            const result = await withdrawalService.initiateWithdrawal(
                mockUserId,
                mockAmount,
                mockBankAccountDetails,
                mockDescription
            );

            // Assert
            expect(result).toEqual({
                transaction: expect.objectContaining(mockTransaction),
                withdrawal: expect.objectContaining(mockWithdrawal)
            });

            // Additional assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, db, true);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.WITHDRAWAL,
                    user_id: mockUserId,
                    amount: mockAmount,
                    reference: expect.stringContaining("WD"),
                    description: mockDescription
                }),
                db
            );
            expect(withdrawalRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction_id: 1,
                    wallet_id: 1,
                    bank_account_id: mockBankAccountDetails
                }),
                db
            );
            expect(withdrawalRepository.findById).toHaveBeenCalledWith(1, db);
            expect(ledgerService.createDoubleEntry).toHaveBeenCalled();
        });

        it("should throw NotFound error when user wallet not found", async () => {
            // Mock walletService.findByUserIdRaw to return null
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.initiateWithdrawal(
                    mockUserId,
                    mockAmount,
                    mockBankAccountDetails,
                    mockDescription
                )
            ).rejects.toThrow(APIError.NotFound("User wallet not found"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, db, true);
        });

        it("should throw BadRequest error when user has insufficient balance", async () => {
            // Mock walletService.findByUserIdRaw for user with insufficient balance
            const mockUserWallet = {
                id: 1,
                user_id: mockUserId,
                wallet_type: WalletType.MAIN,
                balance: 2000, // 20 NGN (less than 50 NGN required)
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);

            // Mock walletService.findSystemWallet for HOLDING wallet
            const mockHoldingWallet = {
                id: 2,
                user_id: null,
                wallet_type: WalletType.HOLDING,
                balance: 50000,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.initiateWithdrawal(
                    mockUserId,
                    mockAmount,
                    mockBankAccountDetails,
                    mockDescription
                )
            ).rejects.toThrow(APIError.BadRequest("Insufficient balance"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, db, true);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
        });

        it("should throw Internal error when holding wallet not found", async () => {
            // Mock walletService.findByUserIdRaw for user
            const mockUserWallet = {
                id: 1,
                user_id: mockUserId,
                wallet_type: WalletType.MAIN,
                balance: 10000,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);

            // Mock walletService.findSystemWallet to return null (holding wallet not found)
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.initiateWithdrawal(
                    mockUserId,
                    mockAmount,
                    mockBankAccountDetails,
                    mockDescription
                )
            ).rejects.toThrow(APIError.Internal("Holding wallet not found"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, db, true);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
        });
    });

    describe("confirmWithdrawal", () => {
        it("should confirm a successful withdrawal", async () => {
            const mockReference = "WD-123456";

            // Mock transactionRepository.findByReference
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: mockReference,
                status: TransactionStatus.PENDING,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock transactionService.updateTransactionStatus
            const updatedTransaction = {
                ...mockTransaction,
                status: TransactionStatus.SUCCESSFUL
            };
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedTransaction);

            // Mock walletService.findSystemWallet for HOLDING wallet
            const mockHoldingWallet = {
                id: 2,
                user_id: null,
                wallet_type: WalletType.HOLDING,
                balance: 100000, // 1000 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            // Mock walletService.findSystemWallet for SYSTEM wallet
            const mockSystemWallet = {
                id: 3,
                user_id: null,
                wallet_type: WalletType.SYSTEM,
                balance: 500000, // 5000 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock)
                .mockResolvedValueOnce(mockHoldingWallet)
                .mockResolvedValueOnce(mockSystemWallet);

            // Mock walletService.decrementBalance and incrementBalance
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);

            // Mock ledgerService.createDoubleEntry
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act
            const result = await withdrawalService.confirmWithdrawal(mockReference, true);

            // Assert
            expect(result).toEqual({
                transaction: expect.objectContaining(updatedTransaction)
            });

            // Additional assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1,
                TransactionStatus.SUCCESSFUL,
                db
            );
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.SYSTEM, db);
            expect(walletService.decrementBalance).toHaveBeenCalledWith(2, mockAmount, db);
            expect(walletService.incrementBalance).toHaveBeenCalledWith(3, mockAmount, db);
            expect(ledgerService.createDoubleEntry).toHaveBeenCalledWith(
                1,
                mockAmount,
                expect.objectContaining({
                    walletId: 3,
                    balanceBefore: 500000,
                    balanceAfter: 500000 + mockAmount
                }),
                expect.objectContaining({
                    walletId: 2,
                    balanceBefore: 100000,
                    balanceAfter: 100000 - mockAmount
                }),
                db
            );
        });

        it("should handle failed withdrawal (reversal)", async () => {
            const mockReference = "WD-123456";
            const mockReversalReference = "REV-123456";

            // Mock transactionRepository.findByReference
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: mockReference,
                status: TransactionStatus.PENDING,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock transactionService.updateTransactionStatus for failed transaction
            const updatedFailedTransaction = {
                ...mockTransaction,
                status: TransactionStatus.FAILED
            };
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedFailedTransaction);

            // Mock transactionService.createTransaction for reversal
            const mockReversalTransaction = {
                id: 2,
                type: TransactionType.REVERSAL,
                user_id: mockUserId,
                amount: mockAmount,
                reference: mockReversalReference,
                status: TransactionStatus.SUCCESSFUL,
                parent_transaction_id: 1,
                description: `Reversal for failed withdrawal ${mockReference}`,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockReversalTransaction);

            // Mock walletService.findSystemWallet for HOLDING wallet
            const mockHoldingWallet = {
                id: 2,
                user_id: null,
                wallet_type: WalletType.HOLDING,
                balance: 100000, // 1000 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            // Mock walletService.findByUserIdRaw for user wallet
            const mockUserWallet = {
                id: 1,
                user_id: mockUserId,
                wallet_type: WalletType.MAIN,
                balance: 0, // After withdrawal
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);

            // Mock walletService.decrementBalance and incrementBalance
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);

            // Mock ledgerService.createDoubleEntry
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act
            const result = await withdrawalService.confirmWithdrawal(mockReference, false);

            // Assert
            expect(result).toEqual({
                transaction: expect.objectContaining({
                    id: 1,
                    reference: mockReference,
                    status: TransactionStatus.FAILED
                }),
                reversalTransaction: expect.objectContaining({
                    id: 2,
                    reference: mockReversalReference,
                    status: TransactionStatus.SUCCESSFUL
                })
            });

            // Additional assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1,
                TransactionStatus.FAILED,
                db
            );
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.REVERSAL,
                    user_id: mockUserId,
                    amount: mockAmount,
                    reference: expect.stringMatching(/^REV-/),
                    status: TransactionStatus.SUCCESSFUL,
                    parent_transaction_id: 1,
                    description: expect.stringContaining(`Reversal for failed withdrawal ${mockReference}`)
                }),
                db
            );
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, db);
            expect(walletService.decrementBalance).toHaveBeenCalledWith(2, mockAmount, db);
            expect(walletService.incrementBalance).toHaveBeenCalledWith(1, mockAmount, db);
            expect(ledgerService.createDoubleEntry).toHaveBeenCalledWith(
                2,
                mockAmount,
                expect.objectContaining({
                    walletId: 1,
                    balanceBefore: 0,
                    balanceAfter: mockAmount
                }),
                expect.objectContaining({
                    walletId: 2,
                    balanceBefore: 100000,
                    balanceAfter: 100000 - mockAmount
                }),
                db
            );
        });

        it("should throw NotFound error when transaction not found", async () => {
            const mockReference = "WD-123456";

            // Mock transactionRepository.findByReference to return null
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow(APIError.NotFound("Transaction not found"));

            // Assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
        });

        it("should throw Conflict error when transaction is not pending", async () => {
            const mockReference = "WD-123456";

            // Mock transactionRepository.findByReference
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: mockReference,
                status: TransactionStatus.SUCCESSFUL, // Already successful
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow(APIError.Conflict("Transaction is not in pending state"));

            // Assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
        });

        it("should throw Internal error when holding wallet not found during confirmation", async () => {
            const mockReference = "WD-123456";

            // Mock transactionRepository.findByReference
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: mockReference,
                status: TransactionStatus.PENDING,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock transactionService.updateTransactionStatus
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue({
                ...mockTransaction,
                status: TransactionStatus.SUCCESSFUL
            });

            // Mock walletService.findSystemWallet to return null (holding wallet not found)
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow(APIError.Internal("Holding wallet not found"));

            // Assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1,
                TransactionStatus.SUCCESSFUL,
                db
            );
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
        });

        it("should throw Internal error when system wallet not found during successful withdrawal", async () => {
            const mockReference = "WD-123456";

            // Mock transactionRepository.findByReference
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: mockReference,
                status: TransactionStatus.PENDING,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock transactionService.updateTransactionStatus
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue({
                ...mockTransaction,
                status: TransactionStatus.SUCCESSFUL
            });

            // Mock walletService.findSystemWallet
            const mockHoldingWallet = {
                id: 2,
                user_id: null,
                wallet_type: WalletType.HOLDING,
                balance: 100000,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock)
                .mockResolvedValueOnce(mockHoldingWallet)
                .mockResolvedValueOnce(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow(APIError.Internal("System wallet not found"));

            // Assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1,
                TransactionStatus.SUCCESSFUL,
                db
            );
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.SYSTEM, db);
        });
    });
});