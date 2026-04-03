import { depositService } from "@/modules/Transactions/Deposit/deposit.service";
import { depositRepository } from "@/modules/Transactions/Deposit/deposit.repo";
import { transactionService } from "@/modules/Transactions/transaction.service";
import { walletService } from "@/modules/Wallet/wallet.service";
import { ledgerService } from "@/modules/Ledger/ledger.service";
import { APIError } from "@/utils/APIError";
import { testDB as db } from "@/configs/db";
import { TransactionType, TransactionStatus } from "@/modules/Transactions/transaction.type";
import { transactionRepository } from "@/modules/Transactions/transaction.repo";
import { WalletType } from "@/modules/Wallet/wallet.type";

// Mock dependencies
jest.mock("@/modules/Transactions/Deposit/deposit.repo");
jest.mock("@/modules/Transactions/transaction.service");
jest.mock("@/modules/Wallet/wallet.service");
jest.mock("@/modules/Ledger/ledger.service");

describe("DepositService", () => {
    const mockUserId = 1;
    const mockAmount = 1000; // 10 NGN in smallest currency unit
    const mockDescription = "Test deposit";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("initiateDeposit", () => {
        it("should initiate a deposit successfully", async () => {
            // Mock transactionService.createTransaction
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: "DEP_123456",
                status: TransactionStatus.PENDING,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock walletService.findByUserId
            const mockWallet = {
                id: 1,
                user_id: mockUserId,
                wallet_type: "MAIN",
                balance: 0,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserId as jest.Mock).mockResolvedValue(mockWallet);



            // Act
            const result = await depositService.initiateDeposit(mockUserId, mockAmount, mockDescription);

            // Assert
            expect(result).toEqual({
                transaction: expect.objectContaining(mockTransaction),
                paymentDetails: {
                    payment_reference: "DEP_123456",
                    provider: "MockPay",
                    paymentUrl: `https://mockpay.com/pay/DEP_123456`
                }
            });

            // Additional assertions
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.FUNDING,
                    user_id: mockUserId,
                    amount: mockAmount,
                    reference: expect.stringContaining("DEP"),
                    description: mockDescription
                }),
                db
            );
            expect(walletService.findByUserId).toHaveBeenCalledWith(mockUserId, db);
        });

        it("should throw NotFound error when user wallet not found", async () => {
            // Mock transactionService.createTransaction
            const mockTransaction = {
                id: 1,
                user_id: mockUserId,
                amount: mockAmount,
                reference: "DEP_123456",
                status: TransactionStatus.PENDING,
                created_at: new Date(),
                updated_at: new Date()
            };
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);

            // Mock walletService.findByUserId to return null
            (walletService.findByUserId as jest.Mock).mockResolvedValue(null);



            // Act & Assert
            await expect(
                depositService.initiateDeposit(mockUserId, mockAmount, mockDescription)
            ).rejects.toThrow(APIError.NotFound("User wallet not found"));

            // Assertions
            expect(transactionService.createTransaction).toHaveBeenCalled();
            expect(walletService.findByUserId).toHaveBeenCalledWith(mockUserId, db);
        });
    });

    describe("confirmDeposit", () => {
        it("should confirm a deposit successfully", async () => {
            const mockReference = "DEP_123456";

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
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue({ transaction: mockTransaction });

            // Mock transactionService.updateTransactionStatus
            const updatedTransaction = {
                ...mockTransaction,
                status: TransactionStatus.SUCCESSFUL
            };
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedTransaction);

            // Mock walletService.findByUserIdRaw
            const mockUserWallet = {
                id: 1,
                user_id: mockUserId,
                wallet_type: "MAIN",
                balance: 0,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);

            // Mock walletService.findSystemWallet
            const mockSystemWallet = {
                id: 2,
                user_id: null,
                wallet_type: "SYSTEM",
                balance: 1000000,
                created_at: new Date(),
                updated_at: new Date()
            };
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockSystemWallet);

            // Mock walletService.incrementBalance and decrementBalance
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);

            // Mock ledgerService.createDoubleEntry
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            // Mock depositRepository.create
            (depositRepository.create as jest.Mock).mockResolvedValue(1);

            // Mock depositRepository.findById
            const mockFunding = {
                id: 1,
                transaction_id: 1,
                wallet_id: 1,
                payment_reference: mockReference,
                provider: "MockPay",
                created_at: new Date()
            };
            (depositRepository.findById as jest.Mock).mockResolvedValue(mockFunding);



            // Act
            const result = await depositService.confirmDeposit(mockReference);

            // Assert
            expect(result).toEqual({
                transaction: expect.objectContaining(updatedTransaction),
                funding: expect.objectContaining(mockFunding)
            });

            // Additional assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1,
                TransactionStatus.SUCCESSFUL,
                db
            );
            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, db);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.SYSTEM, db);
            expect(walletService.incrementBalance).toHaveBeenCalledWith(1, mockAmount, db);
            expect(walletService.decrementBalance).toHaveBeenCalledWith(2, mockAmount, db);
            expect(ledgerService.createDoubleEntry).toHaveBeenCalled();
            expect(depositRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    transaction_id: 1,
                    wallet_id: 1,
                    payment_reference: mockReference,
                    provider: "MockPay"
                }),
                db
            );
            expect(depositRepository.findById).toHaveBeenCalledWith(1, db);
        });

        it("should throw NotFound error when transaction not found", async () => {
            const mockReference = "DEP_123456";

            // Mock transactionRepository.findByReference to return null
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(null);



            // Act & Assert
            await expect(
                depositService.confirmDeposit(mockReference)
            ).rejects.toThrow(APIError.NotFound("Transaction not found"));

            // Assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
        });

        it("should throw Conflict error when transaction is not pending", async () => {
            const mockReference = "DEP_123456";

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
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue({ transaction: mockTransaction });



            // Act & Assert
            await expect(
                depositService.confirmDeposit(mockReference)
            ).rejects.toThrow(APIError.Conflict("Transaction is not in pending state"));

            // Assertions
            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, db);
        });
    });
});