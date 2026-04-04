import { DepositService } from "@/modules/Transactions/Deposit/deposit.service";
import { depositRepository } from "@/modules/Transactions/Deposit/deposit.repo";
import { transactionService } from "@/modules/Transactions/transaction.service";
import { transactionRepository } from "@/modules/Transactions/transaction.repo";
import { walletService } from "@/modules/Wallet/wallet.service";
import { ledgerService } from "@/modules/Ledger/ledger.service";
import { generateReference } from "@/utils/helpers";
import { TransactionStatus, TransactionType } from "@/modules/Transactions/transaction.type";
import { WalletType } from "@/modules/Wallet/wallet.type";
import db from "@/configs/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/modules/Transactions/Deposit/deposit.repo", () => ({
    depositRepository: {
        create: jest.fn(),
        findById: jest.fn(),
        findByTransactionId: jest.fn(),
    },
}));

jest.mock("@/modules/Transactions/transaction.service", () => ({
    transactionService: {
        createTransaction: jest.fn(),
        updateTransactionStatus: jest.fn(),
        sanitize: jest.fn((tx) => tx), // identity — keeps amount as-is in unit tests
    },
}));

jest.mock("@/modules/Transactions/transaction.repo", () => ({
    transactionRepository: {
        findByReference: jest.fn(),
    },
}));

jest.mock("@/modules/Wallet/wallet.service", () => ({
    walletService: {
        findByUserId: jest.fn(),
        findByUserIdRaw: jest.fn(),
        findSystemWallet: jest.fn(),
        incrementBalance: jest.fn(),
        decrementBalance: jest.fn(),
    },
}));

jest.mock("@/modules/Ledger/ledger.service", () => ({
    ledgerService: {
        createDoubleEntry: jest.fn(),
    },
}));

jest.mock("@/utils/helpers", () => ({
    generateReference: jest.fn(),
    hashObject: jest.fn(),
    formatAmount: jest.fn((amount) => amount),
    idempotentControllerWrapper: jest.fn((fn) => fn),
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
    amount: 1000000, // 10,000 NGN in kobo
    reference: "DEP-TEST-00000001",
    parent_transaction_id: null,
    description: "Wallet funding",
    user_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockUpdatedTransaction = {
    ...mockTransaction,
    status: TransactionStatus.SUCCESSFUL,
};

const mockUserWallet = {
    id: 10,
    user_id: 1,
    wallet_type: WalletType.MAIN,
    balance: 500000,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockSystemWallet = {
    id: 99,
    user_id: null,
    wallet_type: WalletType.SYSTEM,
    balance: 10000000,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockFunding = {
    id: 1,
    transaction_id: 1,
    wallet_id: 10,
    payment_reference: "DEP-TEST-00000001",
    provider: "MockPay",
    created_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DepositService", () => {
    let depositService: DepositService;

    beforeEach(() => {
        jest.clearAllMocks();
        depositService = new DepositService();
        (generateReference as jest.Mock).mockReturnValue("DEP-TEST-00000001");
    });

    // ── initiateDeposit ────────────────────────────────────────────────────────

    describe("initiateDeposit", () => {
        it("should create a PENDING transaction and return payment details on success", async () => {
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findByUserId as jest.Mock).mockResolvedValue(mockUserWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            const result = await depositService.initiateDeposit(1, 10000);

            expect(result.transaction).toEqual(mockTransaction);
            expect(result.paymentDetails).toMatchObject({
                payment_reference: "DEP-TEST-00000001",
                provider: "MockPay",
                paymentUrl: expect.stringContaining("DEP-TEST-00000001"),
            });
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.FUNDING,
                    user_id: 1,
                    amount: 1000000, // 10,000 * 100 multiplier
                    reference: "DEP-TEST-00000001",
                }),
                trxMock
            );
        });

        it("should convert the amount to smallest currency unit before saving", async () => {
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findByUserId as jest.Mock).mockResolvedValue(mockUserWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await depositService.initiateDeposit(1, 10000); // 10,000 NGN

            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: 1000000, // 10,000 * 100 = 1,000,000 kobo
                }),
                trxMock
            );
        });

        it("should use a custom description when provided", async () => {
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findByUserId as jest.Mock).mockResolvedValue(mockUserWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await depositService.initiateDeposit(1, 5000, "Salary credit");

            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({ description: "Salary credit" }),
                trxMock
            );
        });

        it("should default description to 'Wallet funding' when none provided", async () => {
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findByUserId as jest.Mock).mockResolvedValue(mockUserWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await depositService.initiateDeposit(1, 5000);

            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({ description: "Wallet funding" }),
                trxMock
            );
        });

        it("should propagate error when walletService.findByUserId throws", async () => {
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findByUserId as jest.Mock).mockRejectedValue(
                new Error("Wallet not found")
            );

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(depositService.initiateDeposit(1, 10000))
                .rejects.toThrow("Wallet not found");
        });
    });

    // ── confirmDeposit ─────────────────────────────────────────────────────────

    describe("confirmDeposit", () => {
        const reference = "DEP-TEST-00000001";

        it("should throw NotFound when transaction reference does not exist", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(undefined);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(depositService.confirmDeposit(reference))
                .rejects.toThrow("Transaction not found");

            expect(transactionService.updateTransactionStatus).not.toHaveBeenCalled();
        });

        it("should throw Conflict when transaction is not in PENDING state", async () => {
            const alreadySuccessful = { ...mockTransaction, status: TransactionStatus.SUCCESSFUL };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(alreadySuccessful);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(depositService.confirmDeposit(reference))
                .rejects.toThrow("Transaction is not in pending state");

            expect(transactionService.updateTransactionStatus).not.toHaveBeenCalled();
        });

        it("should throw Internal when system wallet is not found", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null); // no system wallet

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(depositService.confirmDeposit(reference))
                .rejects.toThrow("System wallet not found");
        });

        it("should throw NotFound when user wallet is not found during confirmation", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            // walletService.findByUserIdRaw throws (as the service does) if wallet not found
            (walletService.findByUserIdRaw as jest.Mock).mockRejectedValue(
                new Error("Wallet not found")
            );

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(depositService.confirmDeposit(reference))
                .rejects.toThrow("Wallet not found");
        });

        it("should throw Internal when funding record cannot be created", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockSystemWallet);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (depositRepository.create as jest.Mock).mockResolvedValue(null); // fails

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(depositService.confirmDeposit(reference))
                .rejects.toThrow("Failed to create funding record");
        });

        it("should complete a deposit successfully", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockSystemWallet);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (depositRepository.create as jest.Mock).mockResolvedValue(1);
            (depositRepository.findById as jest.Mock).mockResolvedValue(mockFunding);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            const result = await depositService.confirmDeposit(reference);

            expect(result.transaction).toEqual(mockUpdatedTransaction);
            expect(result.funding).toEqual(mockFunding);
        });

        it("should update transaction to SUCCESSFUL during confirmation", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockSystemWallet);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (depositRepository.create as jest.Mock).mockResolvedValue(1);
            (depositRepository.findById as jest.Mock).mockResolvedValue(mockFunding);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await depositService.confirmDeposit(reference);

            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                mockTransaction.id,
                TransactionStatus.SUCCESSFUL,
                trxMock
            );
        });

        it("should credit user wallet and debit system wallet with correct amounts", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockSystemWallet);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (depositRepository.create as jest.Mock).mockResolvedValue(1);
            (depositRepository.findById as jest.Mock).mockResolvedValue(mockFunding);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await depositService.confirmDeposit(reference);

            expect(walletService.incrementBalance).toHaveBeenCalledWith(
                mockUserWallet.id,
                mockTransaction.amount,
                trxMock
            );
            expect(walletService.decrementBalance).toHaveBeenCalledWith(
                mockSystemWallet.id,
                mockTransaction.amount,
                trxMock
            );
        });

        it("should create a double-entry ledger with correct credit and debit entries", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(mockUpdatedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockSystemWallet);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (depositRepository.create as jest.Mock).mockResolvedValue(1);
            (depositRepository.findById as jest.Mock).mockResolvedValue(mockFunding);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await depositService.confirmDeposit(reference);

            expect(ledgerService.createDoubleEntry).toHaveBeenCalledWith(
                mockTransaction.id,
                mockTransaction.amount,
                expect.objectContaining({
                    walletId: mockUserWallet.id,
                    balanceBefore: mockUserWallet.balance,
                    balanceAfter: mockUserWallet.balance + mockTransaction.amount,
                }),
                expect.objectContaining({
                    walletId: mockSystemWallet.id,
                    balanceBefore: mockSystemWallet.balance,
                    balanceAfter: mockSystemWallet.balance - mockTransaction.amount,
                }),
                trxMock
            );
        });
    });
});