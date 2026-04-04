import { TransferService } from "@/modules/Transactions/Transfer/transfer.service";
import { transferRepository } from "@/modules/Transactions/Transfer/transfer.repo";
import { transactionService } from "@/modules/Transactions/transaction.service";
import { walletService } from "@/modules/Wallet/wallet.service";
import { ledgerService } from "@/modules/Ledger/ledger.service";
import { generateReference } from "@/utils/helpers";
import { TransactionStatus, TransactionType } from "@/modules/Transactions/transaction.type";
import { WalletRow, WalletType } from "@/modules/Wallet/wallet.type";
import db from "@/configs/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/modules/Transactions/Transfer/transfer.repo", () => ({
    transferRepository: {
        create: jest.fn(),
        findById: jest.fn(),
    },
}));

jest.mock("@/modules/Transactions/transaction.service", () => ({
    transactionService: {
        createTransaction: jest.fn(),
        sanitize: jest.fn((tx) => tx),
    },
}));

// The updated TransferService NO LONGER calls walletService.findByUserIdRaw.
// It locks wallets directly via: trx<WalletRow>("wallets").whereIn(...).forUpdate()
// walletService is only used for findSystemWallet, incrementBalance, decrementBalance.
jest.mock("@/modules/Wallet/wallet.service", () => ({
    walletService: {
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

const mockSenderWallet: WalletRow = {
    id: 10,
    user_id: 1,
    wallet_type: WalletType.MAIN,
    balance: 500000, // 5,000 NGN in kobo
    created_at: new Date(),
    updated_at: new Date(),
};

const mockReceiverWallet: WalletRow = {
    id: 20,
    user_id: 2,
    wallet_type: WalletType.MAIN,
    balance: 100000,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockHoldingWallet: WalletRow = {
    id: 99,
    user_id: null,
    wallet_type: WalletType.HOLDING,
    balance: 0,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockWithdrawalTx = {
    id: 1,
    type: TransactionType.TRANSFER,
    status: TransactionStatus.SUCCESSFUL,
    amount: 200000, // 2,000 NGN in kobo
    reference: "TRF-WD-TEST-001",
    user_id: 1,
    description: "Transfer to user 2",
    parent_transaction_id: null,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockFundingTx = {
    id: 2,
    type: TransactionType.FUNDING,
    status: TransactionStatus.SUCCESSFUL,
    amount: 200000,
    reference: "TRF-FD-TEST-001",
    user_id: 2,
    description: "Transfer from user 1",
    parent_transaction_id: null,
    created_at: new Date(),
    updated_at: new Date(),
};

const mockTransferRecord = {
    id: 1,
    transaction_id: 1,
    sender_wallet_id: 10,
    receiver_wallet_id: 20,
    created_at: new Date(),
};

// ─── trxMock builder ──────────────────────────────────────────────────────────

/**
 * The updated TransferService locks wallets by calling:
 *   trx<WalletRow>("wallets").whereIn("user_id", sortedIds).forUpdate()
 *
 * So trxMock must be a CALLABLE FUNCTION. When called with "wallets" it returns
 * a Knex-like chain: { whereIn → forUpdate → resolves to wallet array }.
 *
 * Other trx usage (passed to walletService.* and transactionService.*) works
 * because those are mocked at the service level and never actually invoke trxMock.
 */
const buildTrxMock = (wallets: WalletRow[]) => {
    const queryChain = {
        whereIn: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockResolvedValue(wallets),
    };
    const trxMock = jest.fn().mockReturnValue(queryChain);
    return { trxMock, queryChain };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TransferService", () => {
    let transferService: TransferService;

    beforeEach(() => {
        jest.clearAllMocks();
        transferService = new TransferService();
        // Two generateReference calls in each successful transfer: TRF-WD then TRF-FD
        (generateReference as jest.Mock)
            .mockReturnValueOnce("TRF-WD-TEST-001")
            .mockReturnValueOnce("TRF-FD-TEST-001");
    });

    // ── initiateTransfer ───────────────────────────────────────────────────────

    describe("initiateTransfer", () => {
        it("should throw BadRequest when sender and receiver are the same user", async () => {
            // Guard fires before db.transaction is called
            await expect(transferService.initiateTransfer(1, 1, 2000))
                .rejects.toThrow("Cannot transfer to yourself");

            expect(db.transaction).not.toHaveBeenCalled();
        });

        it("should throw NotFound when sender wallet is absent from the locked result", async () => {
            // forUpdate returns only receiver wallet — sender missing
            const { trxMock } = buildTrxMock([mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(transferService.initiateTransfer(1, 2, 2000))
                .rejects.toThrow("Sender wallet not found");
        });

        it("should throw NotFound when receiver wallet is absent from the locked result", async () => {
            // forUpdate returns only sender wallet — receiver missing
            const { trxMock } = buildTrxMock([mockSenderWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(transferService.initiateTransfer(1, 2, 2000))
                .rejects.toThrow("Receiver wallet not found");
        });

        it("should throw BadRequest when sender balance is insufficient", async () => {
            const lowBalanceSender = { ...mockSenderWallet, balance: 100 }; // 1 NGN in kobo
            const { trxMock } = buildTrxMock([lowBalanceSender, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);

            // 2,000 NGN = 200,000 kobo but only 100 kobo available
            await expect(transferService.initiateTransfer(1, 2, 2000))
                .rejects.toThrow("Insufficient balance");
        });

        it("should throw Internal when the holding wallet is not found", async () => {
            const { trxMock } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(null);

            await expect(transferService.initiateTransfer(1, 2, 2000))
                .rejects.toThrow("Holding wallet not found");
        });

        it("should complete a transfer and return both transactions plus the transfer record", async () => {
            const { trxMock } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(1);
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransferRecord);

            const result = await transferService.initiateTransfer(1, 2, 2000);

            expect(result.senderTransaction).toEqual(mockWithdrawalTx);
            expect(result.receiverTransaction).toEqual(mockFundingTx);
            expect(result.transfer).toEqual(mockTransferRecord);
        });

        it("should lock both wallets with a single whereIn query on the transaction object", async () => {
            const { trxMock, queryChain } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(1);
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransferRecord);

            await transferService.initiateTransfer(1, 2, 2000);

            expect(trxMock).toHaveBeenCalledWith("wallets");
            expect(queryChain.whereIn).toHaveBeenCalledWith("user_id", [1, 2]);
            expect(queryChain.forUpdate).toHaveBeenCalled();
        });

        it("should sort wallet IDs ascending before locking to prevent deadlocks", async () => {
            // sender=5, receiver=2 — sorted should be [2, 5]
            const senderWallet = { ...mockSenderWallet, user_id: 5 };
            const receiverWallet = { ...mockReceiverWallet, user_id: 2 };
            const { trxMock, queryChain } = buildTrxMock([receiverWallet, senderWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(1);
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransferRecord);

            await transferService.initiateTransfer(5, 2, 2000);

            expect(queryChain.whereIn).toHaveBeenCalledWith("user_id", [2, 5]);
        });

        it("should create two transactions — TRANSFER for sender, FUNDING for receiver", async () => {
            const { trxMock } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(1);
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransferRecord);

            await transferService.initiateTransfer(1, 2, 2000);

            expect(transactionService.createTransaction).toHaveBeenCalledTimes(2);
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.TRANSFER,
                    user_id: 1,
                    status: TransactionStatus.SUCCESSFUL,
                    amount: 200000,
                }),
                trxMock
            );
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: TransactionType.FUNDING,
                    user_id: 2,
                    status: TransactionStatus.SUCCESSFUL,
                    amount: 200000,
                }),
                trxMock
            );
        });

        it("should route money through the holding wallet in two legs", async () => {
            const { trxMock } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(1);
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransferRecord);

            await transferService.initiateTransfer(1, 2, 2000);

            // Leg 1: sender debited, holding credited
            expect(walletService.decrementBalance).toHaveBeenCalledWith(
                mockSenderWallet.id, 200000, trxMock
            );
            expect(walletService.incrementBalance).toHaveBeenCalledWith(
                mockHoldingWallet.id, 200000, trxMock
            );
            // Leg 2: holding debited, receiver credited
            expect(walletService.decrementBalance).toHaveBeenCalledWith(
                mockHoldingWallet.id, 200000, trxMock
            );
            expect(walletService.incrementBalance).toHaveBeenCalledWith(
                mockReceiverWallet.id, 200000, trxMock
            );
            // One double-entry per leg
            expect(ledgerService.createDoubleEntry).toHaveBeenCalledTimes(2);
        });

        it("should use default descriptions when none is provided", async () => {
            const { trxMock } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(1);
            (transferRepository.findById as jest.Mock).mockResolvedValue(mockTransferRecord);

            await transferService.initiateTransfer(1, 2, 2000); // no description

            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({ description: "Transfer to user 2" }),
                trxMock
            );
            expect(transactionService.createTransaction).toHaveBeenCalledWith(
                expect.objectContaining({ description: "Transfer from user 1" }),
                trxMock
            );
        });

        it("should throw Internal when the transfer record cannot be persisted", async () => {
            const { trxMock } = buildTrxMock([mockSenderWallet, mockReceiverWallet]);
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));
            (walletService.findSystemWallet as jest.Mock).mockResolvedValue(mockHoldingWallet);
            (walletService.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            (walletService.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            (transactionService.createTransaction as jest.Mock)
                .mockResolvedValueOnce(mockWithdrawalTx)
                .mockResolvedValueOnce(mockFundingTx);
            (ledgerService.createDoubleEntry as jest.Mock).mockResolvedValue(undefined);
            (transferRepository.create as jest.Mock).mockResolvedValue(null); // fails

            await expect(transferService.initiateTransfer(1, 2, 2000))
                .rejects.toThrow("Failed to create transfer record");
        });
    });
});