import { WithdrawalService } from "@/modules/Transactions/Withdrawal/withdrawal.service";
import { withdrawalRepository } from "@/modules/Transactions/Withdrawal/withdrawal.repo";
import { transactionService } from "@/modules/Transactions/transaction.service";
import { transactionRepository } from "@/modules/Transactions/transaction.repo";
import { walletService } from "@/modules/Wallet/wallet.service";
import { ledgerService } from "@/modules/Ledger/ledger.service";
import { generateReference } from "@/utils/helpers";
import { TransactionType, TransactionStatus } from "@/modules/Transactions/transaction.type";
import { WalletType } from "@/modules/Wallet/wallet.type";
import db from "@/configs/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/modules/Transactions/Withdrawal/withdrawal.repo", () => ({
    withdrawalRepository: {
        create: jest.fn(),
        findById: jest.fn(),
        findByTransactionId: jest.fn(),
    },
}));

jest.mock("@/modules/Transactions/transaction.service", () => ({
    transactionService: {
        createTransaction: jest.fn(),
        updateTransactionStatus: jest.fn(),
        sanitize: jest.fn((tx) => tx),
    },
}));

jest.mock("@/modules/Transactions/transaction.repo", () => ({
    transactionRepository: {
        findByReference: jest.fn(),
    },
}));

jest.mock("@/modules/Wallet/wallet.service", () => ({
    walletService: {
        findByUserIdRaw: jest.fn(),
        findSystemWallet: jest.fn(),
        decrementBalance: jest.fn(),
        incrementBalance: jest.fn(),
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

const mockUserId = 1;
const mockAmount = 50; // 50 NGN — service converts to 5000 kobo (50 * 100)
const mockAmountKobo = 5000;
const mockBankAccountDetails = "1234567890";
const mockReference = "WD-TEST-00000001";
const mockReversalReference = "REV-TEST-00000001";

const mockUserWallet = {
    id: 1,
    user_id: mockUserId,
    wallet_type: WalletType.MAIN,
    balance: 50000, // 500 NGN — sufficient for test
    created_at: new Date(),
    updated_at: new Date(),
};

const mockHoldingWallet = {
    id: 2,
    user_id: null,
    wallet_type: WalletType.HOLDING,
    balance: 100000,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockSystemWallet = {
    id: 3,
    user_id: null,
    wallet_type: WalletType.SYSTEM,
    balance: 500000,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockTransaction = {
    id: 1,
    type: TransactionType.WITHDRAWAL,
    status: TransactionStatus.PENDING,
    amount: mockAmountKobo,
    reference: mockReference,
    user_id: mockUserId,
    parent_transaction_id: null,
    description: "Wallet withdrawal",
    created_at: new Date(),
    updated_at: new Date(),
};

const mockWithdrawal = {
    id: 1,
    transaction_id: 1,
    wallet_id: 1,
    bank_account_id: mockBankAccountDetails,
    created_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WithdrawalService", () => {
    let withdrawalService: WithdrawalService;

    beforeEach(() => {
        jest.clearAllMocks();
        withdrawalService = new WithdrawalService();
        (generateReference as jest.Mock)
            .mockReturnValueOnce(mockReference)
            .mockReturnValueOnce(mockReversalReference);
    });

    // ── initiateWithdrawal ─────────────────────────────────────────────────────

    describe("initiateWithdrawal", () => {
        it("should initiate a withdrawal successfully", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (withdrawalRepository.create as jest.Mock).mockResolvedValue(1);
            (withdrawalRepository.findById as jest.Mock).mockResolvedValue(mockWithdrawal);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            const result = await withdrawalService.initiateWithdrawal(
                mockUserId, mockAmount, mockBankAccountDetails, "Test withdrawal"
            );

            expect(result.transaction).toEqual(mockTransaction);
            expect(result.withdrawal).toEqual(mockWithdrawal);
        });

        it("should convert amount to kobo before creating the transaction", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (withdrawalRepository.create as jest.Mock).mockResolvedValue(1);
            (withdrawalRepository.findById as jest.Mock).mockResolvedValue(mockWithdrawal);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await withdrawalService.initiateWithdrawal(mockUserId, mockAmount, mockBankAccountDetails);

            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({ amount: mockAmountKobo }), // 50 NGN * 100 = 5000 kobo
                trxMock
            );
        });

        it("should throw when user wallet is not found", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockRejectedValue(
                new Error("Wallet not found")
            );

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.initiateWithdrawal(mockUserId, mockAmount, mockBankAccountDetails)
            ).rejects.toThrow("Wallet not found");

            expect(walletService.findByUserIdRaw).toHaveBeenCalledWith(mockUserId, trxMock, true);
        });

        it("should throw BadRequest when balance is insufficient", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue({
                ...mockUserWallet,
                balance: 100, // 1 NGN — less than 50 NGN withdrawal
            });
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.initiateWithdrawal(mockUserId, mockAmount, mockBankAccountDetails)
            ).rejects.toThrow("Insufficient balance");

            expect(transactionService.createTransaction).not.toHaveBeenCalled();
        });

        it("should throw Internal when holding wallet is not found", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.initiateWithdrawal(mockUserId, mockAmount, mockBankAccountDetails)
            ).rejects.toThrow("Holding wallet not found");

            expect(transactionService.createTransaction).not.toHaveBeenCalled();
        });

        it("should debit user wallet and credit holding wallet", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (withdrawalRepository.create as jest.Mock).mockResolvedValue(1);
            (withdrawalRepository.findById as jest.Mock).mockResolvedValue(mockWithdrawal);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await withdrawalService.initiateWithdrawal(mockUserId, mockAmount, mockBankAccountDetails);

            expect(walletService.decrementBalance).toHaveBeenCalledWith(
                mockUserWallet.id, mockTransaction.amount, trxMock
            );
            expect(walletService.incrementBalance).toHaveBeenCalledWith(
                mockHoldingWallet.id, mockTransaction.amount, trxMock
            );
        });

        it("should create a double-entry ledger entry on initiation", async () => {
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (withdrawalRepository.create as jest.Mock).mockResolvedValue(1);
            (withdrawalRepository.findById as jest.Mock).mockResolvedValue(mockWithdrawal);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await withdrawalService.initiateWithdrawal(mockUserId, mockAmount, mockBankAccountDetails);

            expect(ledgerService.createDoubleEntry).toHaveBeenCalledWith(
                mockTransaction.id,
                mockTransaction.amount,
                expect.objectContaining({
                    walletId: mockHoldingWallet.id,
                    balanceBefore: mockHoldingWallet.balance,
                    balanceAfter: mockHoldingWallet.balance + mockTransaction.amount,
                }),
                expect.objectContaining({
                    walletId: mockUserWallet.id,
                    balanceBefore: mockUserWallet.balance,
                    balanceAfter: mockUserWallet.balance - mockTransaction.amount,
                }),
                trxMock
            );
        });
    });

    // ── confirmWithdrawal ──────────────────────────────────────────────────────

    describe("confirmWithdrawal", () => {
        it("should throw NotFound when transaction reference does not exist", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(undefined);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow("Transaction not found");

            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, trxMock);
        });

        it("should throw Conflict when transaction is not in PENDING state", async () => {
            const alreadySuccessful = { ...mockTransaction, status: TransactionStatus.SUCCESSFUL };
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(alreadySuccessful);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow("Transaction is not in pending state");
        });

        it("should throw Internal when holding wallet is not found", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            // Holding wallet is fetched BEFORE the if(success) block
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow("Holding wallet not found");

            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, trxMock);
            // updateTransactionStatus is inside if(success) — never reached when holding wallet throws
            expect(transactionService.updateTransactionStatus).not.toHaveBeenCalled();
        });

        it("should throw Internal when system wallet is not found on successful confirmation", async () => {
            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            // FIX: holding returns first, then system returns null — must use mockResolvedValueOnce
            (walletService.findSystemWallet as jest.Mock)
                .mockResolvedValueOnce(mockHoldingWallet) // HOLDING
                .mockResolvedValueOnce(null);             // SYSTEM
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue({
                ...mockTransaction,
                status: TransactionStatus.SUCCESSFUL,
            });

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(
                withdrawalService.confirmWithdrawal(mockReference, true)
            ).rejects.toThrow("System wallet not found");

            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.HOLDING, trxMock);
            expect(walletService.findSystemWallet).toHaveBeenCalledWith(WalletType.SYSTEM, trxMock);
            // updateTransactionStatus IS called before the system wallet check
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1, TransactionStatus.SUCCESSFUL, trxMock
            );
        });

        it("should confirm a successful withdrawal", async () => {
            const updatedTransaction = { ...mockTransaction, status: TransactionStatus.SUCCESSFUL };

            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            // FIX: chain mockResolvedValueOnce so HOLDING and SYSTEM return correct values
            (walletService.findSystemWallet as jest.Mock)
                .mockResolvedValueOnce(mockHoldingWallet) // HOLDING
                .mockResolvedValueOnce(mockSystemWallet);  // SYSTEM
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedTransaction);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            // FIX: assert against updatedTransaction (SUCCESSFUL), not mockTransaction (PENDING)
            const result = await withdrawalService.confirmWithdrawal(mockReference, true);
            expect(result).toEqual({ transaction: expect.objectContaining(updatedTransaction) });

            expect(transactionRepository.findByReference).toHaveBeenCalledWith(mockReference, trxMock);
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1, TransactionStatus.SUCCESSFUL, trxMock
            );
            expect(walletService.decrementBalance).toHaveBeenCalledWith(
                mockHoldingWallet.id, mockTransaction.amount, trxMock
            );
            expect(walletService.incrementBalance).toHaveBeenCalledWith(
                mockSystemWallet.id, mockTransaction.amount, trxMock
            );
        });

        it("should create a reversal and return the user funds on failed withdrawal", async () => {
            const updatedFailedTransaction = { ...mockTransaction, status: TransactionStatus.FAILED };
            const mockReversalTransaction = {
                id: 2,
                type: TransactionType.REVERSAL,
                status: TransactionStatus.SUCCESSFUL,
                amount: mockAmountKobo,
                // FIX: mockReversalReference is set by the second generateReference call in beforeEach
                reference: mockReversalReference,
                parent_transaction_id: mockTransaction.id,
                user_id: mockUserId,
                description: `Reversal for failed withdrawal ${mockReference}`,
                created_at: new Date(),
                updated_at: new Date(),
            };

            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockReversalTransaction);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedFailedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            const result = await withdrawalService.confirmWithdrawal(mockReference, false);

            expect(result).toEqual({
                transaction: expect.objectContaining({
                    id: 1,
                    reference: mockReference,
                    status: TransactionStatus.FAILED,
                }),
                reversalTransaction: expect.objectContaining({
                    id: 2,
                    reference: mockReversalReference,
                    status: TransactionStatus.SUCCESSFUL,
                }),
            });
        });

        it("should create reversal BEFORE marking original as FAILED", async () => {
            const updatedFailedTransaction = { ...mockTransaction, status: TransactionStatus.FAILED };
            const mockReversalTx = {
                id: 2,
                type: TransactionType.REVERSAL,
                status: TransactionStatus.SUCCESSFUL,
                amount: mockAmountKobo,
                reference: mockReversalReference,
                parent_transaction_id: 1,
                user_id: mockUserId,
                created_at: new Date(),
                updated_at: new Date(),
            };

            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockReversalTx);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedFailedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await withdrawalService.confirmWithdrawal(mockReference, false);

            // The reversal transaction is created first (REVERSAL type with SUCCESSFUL status)
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.REVERSAL,
                    user_id: mockUserId,
                    amount: mockAmountKobo,
                    reference: expect.stringMatching(/^REV-/),
                    status: TransactionStatus.SUCCESSFUL,
                    parent_transaction_id: mockTransaction.id,
                    description: expect.stringContaining(`Reversal for failed withdrawal ${mockReference}`),
                }),
                trxMock
            );

            // Then the original transaction is updated to FAILED
            expect(transactionService.updateTransactionStatus).toHaveBeenCalledWith(
                1, TransactionStatus.FAILED, trxMock
            );
        });

        it("should return funds to user wallet via holding on reversal", async () => {
            const updatedFailedTransaction = { ...mockTransaction, status: TransactionStatus.FAILED };
            const mockReversalTx = {
                id: 2, type: TransactionType.REVERSAL, status: TransactionStatus.SUCCESSFUL,
                amount: mockAmountKobo, reference: mockReversalReference,
                parent_transaction_id: 1, user_id: mockUserId, created_at: new Date(), updated_at: new Date(),
            };

            (transactionRepository.findByReference as jest.Mock).mockResolvedValue(mockTransaction);
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (transactionService.createTransaction as jest.Mock).mockResolvedValue(mockReversalTx);
            (transactionService.updateTransactionStatus as jest.Mock).mockResolvedValue(updatedFailedTransaction);
            (walletService.findByUserIdRaw as jest.Mock).mockResolvedValue(mockUserWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await withdrawalService.confirmWithdrawal(mockReference, false);

            // Holding is debited, user wallet is credited
            expect(walletService.decrementBalance).toHaveBeenCalledWith(
                mockHoldingWallet.id, mockTransaction.amount, trxMock
            );
            expect(walletService.incrementBalance).toHaveBeenCalledWith(
                mockUserWallet.id, mockTransaction.amount, trxMock
            );
        });
    });
});