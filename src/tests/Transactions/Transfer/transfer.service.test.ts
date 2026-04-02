import { transferService } from "@/modules/Transactions/Transfer/transfer.service";
import { transactionService } from "@/modules/Transactions/transaction.service";
import { walletService } from "@/modules/Wallet/wallet.service";
import { ledgerService } from "@/modules/Ledger/ledger.service";
import { transferRepository } from "@/modules/Transactions/Transfer/transfer.repo";
import { APIError } from "@/utils/APIError";
import db from "@/configs/db";
import { Currency, CURRENCY_CONFIG, TransactionType, TransactionStatus } from "@/modules/Transactions/transaction.type";
import { WalletType } from "@/modules/Wallet/wallet.type";

// Mock dependencies
jest.mock("@/modules/Transactions/transaction.service");
jest.mock("@/modules/Wallet/wallet.service");
jest.mock("@/modules/Ledger/ledger.service");
jest.mock("@/modules/Transactions/Transfer/transfer.repo");
jest.mock("@/configs/db");

describe("TransferService", () => {
    const mockSenderUserId = 1;
    const mockReceiverUserId = 2;
    const mockAmount = 5000; // 50 NGN in smallest currency unit
    const mockDescription = "Test transfer";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("initiateTransfer", () => {
        it("should initiate a transfer successfully", async () => {
            // Mock walletService.findByUserIdRaw for sender
            const mockSenderWallet = {
                id: 1,
                user_id: mockSenderUserId,
                wallet_type: WalletType.MAIN,
                balance: 10000, // 100 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock)
                .mockResolvedValueOnce(mockSenderWallet) // sender wallet with lock
                .mockResolvedValueOnce({ // receiver wallet without lock
                    id: 2,
                    user_id: mockReceiverUserId,
                    wallet_type: WalletType.MAIN,
                    balance: 5000, // 50 NGN
                    created_at: new Date(),
                    updated_at: new Date()
                });

            // Mock walletService.findSystemWallet for HOLDING wallet
            const mockHoldingWallet = {
                id: 3,
                user_id: null,
                wallet_type: WalletType.HOLDING,
                balance: 50000, // 500 NGN
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            // Mock transactionService.createTransaction for withdrawal
            const mockWithdrawalTransaction = {
                id: 1,
                type: TransactionType.TRANSFER,
                user_id: mockSenderUserId,
                amount: mockAmount,
                status: TransactionStatus.SUCCESSFUL,
                reference: "TRF-WD-123456",
                description: mockDescription,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTransaction) // withdrawal transaction
                .mockResolvedValueOnce({ // funding transaction
                    id: 2,
                    type: TransactionType.FUNDING,
                    user_id: mockReceiverUserId,
                    amount: mockAmount,
                    status: TransactionStatus.SUCCESSFUL,
                    reference: "TRF-FD-123456",
                    description: mockDescription,
                    created_at: new Date(),
                    updated_at: new Date()
                });

            // Mock ledgerService.createDoubleEntry
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            // Mock transferRepository.create
            (transferRepository.create as jest.Mock).mockResolvedValue(1);

            // Mock transferRepository.findById
            const mockTransfer = {
                id: 1,
                transaction_id: 1,
                sender_wallet_id: 1,
                receiver_wallet_id: 2,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransfer);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act
            const result = await transferService.initiateTransfer(
                mockSenderUserId,
                mockReceiverUserId,
                mockAmount,
                mockDescription
            );

            // Assert
            expect(result).toEqual({
                senderTransaction: expect.objectContaining(mockWithdrawalTransaction),
                receiverTransaction: expect.objectContaining({
                    id: 2,
                    type: TransactionType.FUNDING,
                    user_id: mockReceiverUserId,
                    amount: mockAmount,
                    status: TransactionStatus.SUCCESSFUL,
                    reference: "TRF-FD-123456",
                    description: mockDescription
                }),
                transfer: expect.objectContaining(mockTransfer)
            });

            // Additional assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockSenderUserId, db, true); // sender with lock
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockReceiverUserId, db); // receiver without lock
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
            expect(transactionService.createTransaction).toHaveBeenCalledTimes(2);
            expect(ledgerService.createDoubleEntry).toHaveBeenCalledTimes(2);
            expect(walletService.decrementBalance).toHaveBeenCalledWith(1, mockAmount, db); // sender debit
            expect(walletService.incrementBalance).toHaveBeenCalledWith(3, mockAmount, db); // holding credit
            expect(walletService.decrementBalance).toHaveBeenCalledWith(3, mockAmount, db); // holding debit
            expect(walletService.incrementBalance).toHaveBeenCalledWith(2, mockAmount, db); // receiver credit
            expect(transferRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction_id: 1,
                    sender_wallet_id: 1,
                    receiver_wallet_id: 2
                }),
                db
            );
            expect(transferRepository.findById).toHaveBeenCalledWith(1, db);
        });

        it("should throw BadRequest error when transferring to self", async () => {
            // Act & Assert
            await expect(
                transferService.initiateTransfer(
                    mockSenderUserId,
                    mockSenderUserId, // same user
                    mockAmount,
                    mockDescription
                )
            ).rejects.toThrow(APIError.BadRequest("Cannot transfer to yourself"));

            // Assertions
            expect(walletService.findByUserIdRaw).not.toHaveBeenCalled();
        });

        it("should throw NotFound error when sender wallet not found", async () => {
            // Mock walletService.findByUserIdRaw to return null for sender
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                transferService.initiateTransfer(
                    mockSenderUserId,
                    mockReceiverUserId,
                    mockAmount,
                    mockDescription
                )
            ).rejects.toThrow(APIError.NotFound("Sender wallet not found"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockSenderUserId, db, true);
        });

        it("should throw NotFound error when receiver wallet not found", async () => {
            // Mock walletService.findByUserIdRaw for sender
            const mockSenderWallet = {
                id: 1,
                user_id: mockSenderUserId,
                wallet_type: WalletType.MAIN,
                balance: 10000,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock)
                .mockResolvedValueOnce(mockSenderWallet) // sender wallet
                .mockResolvedValueOnce(null); // receiver wallet not found

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                transferService.initiateTransfer(
                    mockSenderUserId,
                    mockReceiverUserId,
                    mockAmount,
                    mockDescription
                )
            ).rejects.toThrow(APIError.NotFound("Receiver wallet not found"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockSenderUserId, db, true);
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockReceiverUserId, db);
        });

        it("should throw BadRequest error when sender has insufficient balance", async () => {
            // Mock walletService.findByUserIdRaw for sender with insufficient balance
            const mockSenderWallet = {
                id: 1,
                user_id: mockSenderUserId,
                wallet_type: WalletType.MAIN,
                balance: 2000, // 20 NGN (less than 50 NGN required)
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock)
                .mockResolvedValueOnce(mockSenderWallet) // sender wallet
                .mockResolvedValueOnce({ // receiver wallet
                    id: 2,
                    user_id: mockReceiverUserId,
                    wallet_type: WalletType.MAIN,
                    balance: 5000,
                    created_at: new Date(),
                    updated_at: new Date()
                });

            // Mock walletService.findSystemWallet for HOLDING wallet
            const mockHoldingWallet = {
                id: 3,
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
                transferService.initiateTransfer(
                    mockSenderUserId,
                    mockReceiverUserId,
                    mockAmount,
                    mockDescription
                )
            ).rejects.toThrow(APIError.BadRequest("Insufficient balance"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockSenderUserId, db, true);
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockReceiverUserId, db);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
        });

        it("should throw Internal error when holding wallet not found", async () => {
            // Mock walletService.findByUserIdRaw for sender
            const mockSenderWallet = {
                id: 1,
                user_id: mockSenderUserId,
                wallet_type: WalletType.MAIN,
                balance: 10000,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock)
                .mockResolvedValueOnce(mockSenderWallet) // sender wallet
                .mockResolvedValueOnce({ // receiver wallet
                    id: 2,
                    user_id: mockReceiverUserId,
                    wallet_type: WalletType.MAIN,
                    balance: 5000,
                    created_at: new Date(),
                    updated_at: new Date()
                });

            // Mock walletService.findSystemWallet to return null (holding wallet not found)
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null);

            // Mock db.transaction to execute the callback directly
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback(db);
            });

            // Act & Assert
            await expect(
                transferService.initiateTransfer(
                    mockSenderUserId,
                    mockReceiverUserId,
                    mockAmount,
                    mockDescription
                )
            ).rejects.toThrow(APIError.Internal("Holding wallet not found"));

            // Assertions
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockSenderUserId, db, true);
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockReceiverUserId, db);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, db);
        });
    });
});