import { TransactionService } from "@/modules/Transactions/transaction.service";
import { transactionRepository } from "@/modules/Transactions/transaction.repo";
import { depositRepository } from "@/modules/Transactions/Deposit/deposit.repo";
import { withdrawalRepository } from "@/modules/Transactions/Withdrawal/withdrawal.repo";
import { transferRepository } from "@/modules/Transactions/Transfer/transfer.repo";
import { walletRepository } from "@/modules/Wallet/wallet.repo";
import { userRepository } from "@/modules/User/user.repo";
import { TransactionStatus, TransactionType } from "@/modules/Transactions/transaction.type";
import db from "@/configs/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/modules/Transactions/transaction.repo", () => ({
    transactionRepository: {
        findByReference: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        updateStatus: jest.fn(),
        findWithFilters: jest.fn(),
    },
}));

jest.mock("@/modules/Transactions/Deposit/deposit.repo", () => ({
    depositRepository: {
        findByTransactionId: jest.fn(),
    },
}));

jest.mock("@/modules/Transactions/Withdrawal/withdrawal.repo", () => ({
    withdrawalRepository: {
        findByTransactionId: jest.fn(),
    },
}));

jest.mock("@/modules/Transactions/Transfer/transfer.repo", () => ({
    transferRepository: {
        findByTransactionId: jest.fn(),
    },
}));

jest.mock("@/modules/Wallet/wallet.repo", () => ({
    walletRepository: {
        findById: jest.fn(),
    },
}));

jest.mock("@/modules/User/user.repo", () => ({
    userRepository: {
        findById: jest.fn(),
    },
}));

jest.mock("@/configs/db", () => {
    const mockDb = jest.fn();
    (mockDb as any).transaction = jest.fn();
    return { __esModule: true, default: mockDb };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockTransaction = {
    id: 1,
    type: TransactionType.FUNDING,
    status: TransactionStatus.PENDING,
    amount: 1000000,
    reference: "DEP-TEST-00000001",
    parent_transaction_id: null,
    description: "Wallet funding",
    user_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
};

const createDto = {
    type: TransactionType.FUNDING,
    user_id: 1,
    amount: 1000000,
    reference: "DEP-TEST-00000001",
    description: "Wallet funding",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TransactionService", () => {
    let transactionService: TransactionService;

    beforeEach(() => {
        jest.clearAllMocks();
        transactionService = new TransactionService();
    });

    // ── createTransaction ──────────────────────────────────────────────────────

    describe("createTransaction", () => {
        it("should throw Conflict when a transaction with the same reference already exists", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);

            await expect(transactionService.createTransaction(createDto))
                .rejects.toThrow("Transaction with this reference already exists");

            expect(transactionRepository.create).not.toHaveBeenCalled();
        });

        it("should throw Internal when repository.create returns null", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(undefined);
            (transactionRepository.create as jest.Mock).mockResolvedValue(null);

            await expect(transactionService.createTransaction(createDto))
                .rejects.toThrow("Failed to create transaction");
        });

        it("should throw Internal when findById returns null after creation", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(undefined);
            (transactionRepository.create as jest.Mock).mockResolvedValue(1);
            (transactionRepository.findById as jest.Mock).mockResolvedValue(null);

            await expect(transactionService.createTransaction(createDto))
                .rejects.toThrow("Failed to retrieve created transaction");
        });

        it("should create and return the transaction on success", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(undefined);
            (transactionRepository.create as jest.Mock).mockResolvedValue(1);
            (transactionRepository.findById as jest.Mock).mockResolvedValue(mockTransaction);

            const result = await transactionService.createTransaction(createDto);

            expect(result).toEqual(mockTransaction);
            expect(transactionRepository.create).toHaveBeenCalledWith(createDto, db);
        });

        it("should pass the database parameter through to repository calls", async () => {
            const fakeTrx = {} as any;
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(undefined);
            (transactionRepository.create as jest.Mock).mockResolvedValue(1);
            (transactionRepository.findById as jest.Mock).mockResolvedValue(mockTransaction);

            await transactionService.createTransaction(createDto, fakeTrx);

            expect(transactionRepository.findByReference).toHaveBeenCalledWith(createDto.reference, fakeTrx);
            expect(transactionRepository.create).toHaveBeenCalledWith(createDto, fakeTrx);
            expect(transactionRepository.findById).toHaveBeenCalledWith(1, fakeTrx);
        });
    });

    // ── updateTransactionStatus ────────────────────────────────────────────────

    describe("updateTransactionStatus", () => {
        it("should throw Internal when updateStatus returns falsy", async () => {
            (transactionRepository.updateStatus as jest.Mock).mockResolvedValue(null);

            await expect(
                transactionService.updateTransactionStatus(1, TransactionStatus.SUCCESSFUL)
            ).rejects.toThrow("Failed to update transaction status");
        });

        it("should return the updated transaction on success", async () => {
            const updated = { ...mockTransaction, status: TransactionStatus.SUCCESSFUL };
            (transactionRepository.updateStatus as jest.Mock).mockResolvedValue(1); // affected rows
            (transactionRepository.findById as jest.Mock).mockResolvedValue(updated);

            const result = await transactionService.updateTransactionStatus(
                1,
                TransactionStatus.SUCCESSFUL
            );

            expect(result).toEqual(updated);
            expect(transactionRepository.updateStatus).toHaveBeenCalledWith(
                1,
                TransactionStatus.SUCCESSFUL,
                db
            );
        });
    });

    // ── getTransactionById ─────────────────────────────────────────────────────

    describe("getTransactionById", () => {
        it("should throw NotFound when transaction does not exist", async () => {
            (transactionRepository.findById as jest.Mock).mockResolvedValue(null);

            await expect(transactionService.getTransactionById(999))
                .rejects.toThrow("Transaction not found");
        });

        it("should throw Forbidden when userId is provided but does not match transaction owner", async () => {
            (transactionRepository.findById as jest.Mock).mockResolvedValue(mockTransaction);
            // mockTransaction.user_id = 1, but requesting as user 2
            await expect(transactionService.getTransactionById(1, 2))
                .rejects.toThrow("Access denied");
        });

        it("should return transaction with details when userId matches the owner", async () => {
            const mockFunding = {
                id: 1,
                transaction_id: 1,
                wallet_id: 10,
                payment_reference: "DEP-TEST-00000001",
                provider: "MockPay",
            };
            (transactionRepository.findById as jest.Mock).mockResolvedValue(mockTransaction);
            (depositRepository.findByTransactionId as jest.Mock).mockResolvedValue(mockFunding);

            const result = await transactionService.getTransactionById(1, 1);

            expect(result).toHaveProperty("id", 1);
            expect(result).toHaveProperty("details");
            expect(result.details).toMatchObject({ type: "funding" });
        });

        it("should return transaction with details when no userId is provided (admin access)", async () => {
            (transactionRepository.findById as jest.Mock).mockResolvedValue(mockTransaction);
            (depositRepository.findByTransactionId as jest.Mock).mockResolvedValue(null);

            const result = await transactionService.getTransactionById(1);

            expect(result).toHaveProperty("id", 1);
            // No userId provided → no access check → should succeed
        });

        it("should include transfer receiver details for TRANSFER transactions", async () => {
            const transferTx = {
                ...mockTransaction,
                type: TransactionType.TRANSFER,
                reference: "TRF-TEST-001",
            };
            const mockTransfer = {
                id: 1,
                transaction_id: 1,
                sender_wallet_id: 10,
                receiver_wallet_id: 20,
            };
            const mockReceiverWallet = { id: 20, user_id: 2, balance: 0 };
            const mockReceiver = { id: 2, name: "Alice Okafor", email: "alice@demo.com" };

            (transactionRepository.findById as jest.Mock).mockResolvedValue(transferTx);
            (transferRepository.findByTransactionId as jest.Mock).mockResolvedValue(mockTransfer);
            (walletRepository.findById as jest.Mock).mockResolvedValue(mockReceiverWallet);
            (userRepository.findById as jest.Mock).mockResolvedValue(mockReceiver);

            const result = await transactionService.getTransactionById(1, 1);

            expect(result.details).toMatchObject({
                type: "transfer",
                receiver: expect.objectContaining({
                    id: 2,
                    name: "Alice Okafor",
                    email: "alice@demo.com",
                }),
            });
        });
    });

    // ── getTransactions ────────────────────────────────────────────────────────

    describe("getTransactions", () => {
        it("should return paginated transaction list and sanitize amounts", async () => {
            const mockResult = {
                transactions: [mockTransaction],
                pagination: { page: 1, total: 1, limit: 20 },
            };
            (transactionRepository.findWithFilters as jest.Mock).mockResolvedValue(mockResult);

            const result = await transactionService.getTransactions({ user_id: 1 });

            expect(result.transactions).toHaveLength(1);
            expect(result.pagination).toMatchObject({ page: 1, total: 1 });
            expect(transactionRepository.findWithFilters).toHaveBeenCalledWith(
                { user_id: 1 },
                {},
                db
            );
        });

        it("should return empty list when user has no transactions", async () => {
            (transactionRepository.findWithFilters as jest.Mock).mockResolvedValue({
                transactions: [],
                pagination: { page: 1, total: 0, limit: 20 },
            });

            const result = await transactionService.getTransactions({ user_id: 999 });

            expect(result.transactions).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
        });
    });
});