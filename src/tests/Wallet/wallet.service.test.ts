import { WalletService } from "@/modules/Wallet/wallet.service";
import { walletRepository } from "@/modules/Wallet/wallet.repo";
import { WalletType } from "@/modules/Wallet/wallet.type";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/modules/Wallet/wallet.repo", () => ({
    walletRepository: {
        create: jest.fn(),
        findById: jest.fn(),
        findByUserId: jest.fn(),
        findSystemWallet: jest.fn(),
        incrementBalance: jest.fn(),
        decrementBalance: jest.fn(),
    },
}));

// Mock db so the same singleton the service uses as its default arg is
// available for toHaveBeenCalledWith assertions
jest.mock("@/configs/db", () => {
    const mockDb = jest.fn();
    (mockDb as any).transaction = jest.fn();
    return { __esModule: true, default: mockDb };
});

// Import AFTER jest.mock so we get the mocked instance
import db from "@/configs/db";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockWallet = {
    id: 1,
    user_id: 1,
    wallet_type: WalletType.MAIN,
    balance: 0,
    created_at: new Date(),
    updated_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WalletService", () => {
    let walletService: WalletService;

    beforeEach(() => {
        jest.clearAllMocks();
        walletService = new WalletService();
    });

    // ── createWallet ───────────────────────────────────────────────────────────

    describe("createWallet", () => {
        it("should create a wallet and return it on success", async () => {
            (walletRepository.create as jest.Mock).mockResolvedValue(1);
            (walletRepository.findById as jest.Mock).mockResolvedValue(mockWallet);

            const result = await walletService.createWallet(1, WalletType.MAIN);

            expect(result).toEqual(mockWallet);
            expect(walletRepository.create).toHaveBeenCalledWith(
                { user_id: 1, wallet_type: WalletType.MAIN },
                db
            );
            expect(walletRepository.findById).toHaveBeenCalledWith(1, db);
        });

        it("should forward a Knex transaction to the repository when provided", async () => {
            const fakeTrx = {} as any;
            (walletRepository.create as jest.Mock).mockResolvedValue(1);
            (walletRepository.findById as jest.Mock).mockResolvedValue(mockWallet);

            await walletService.createWallet(1, WalletType.MAIN, fakeTrx);

            expect(walletRepository.create).toHaveBeenCalledWith(
                { user_id: 1, wallet_type: WalletType.MAIN },
                fakeTrx
            );
            expect(walletRepository.findById).toHaveBeenCalledWith(1, fakeTrx);
        });

        it("should throw APIError.Internal (500) when repository.create returns null", async () => {
            (walletRepository.create as jest.Mock).mockResolvedValue(null);

            await expect(walletService.createWallet(1, WalletType.MAIN))
                .rejects.toMatchObject({ statusCode: 500, message: "Failed to create wallet" });

            expect(walletRepository.findById).not.toHaveBeenCalled();
        });
    });

    // ── findByUserId ───────────────────────────────────────────────────────────

    describe("findByUserId", () => {
        it("should return the wallet with balance converted from kobo to NGN", async () => {
            // 100,000 kobo ÷ 100 multiplier = 1,000 NGN
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue({
                ...mockWallet,
                balance: 100000,
            });

            const result = await walletService.findByUserId(1);

            expect(result.balance).toBe(1000);
            expect(walletRepository.findByUserId).toHaveBeenCalledWith(1, db);
        });

        it("should preserve zero balance correctly", async () => {
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue({
                ...mockWallet,
                balance: 0,
            });

            const result = await walletService.findByUserId(1);

            expect(result.balance).toBe(0);
        });

        it("should throw APIError.NotFound (404) when wallet does not exist", async () => {
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue(undefined);

            // Updated service throws APIError.NotFound, not a plain Error
            await expect(walletService.findByUserId(999))
                .rejects.toMatchObject({ statusCode: 404, message: "Wallet not found" });

            expect(walletRepository.findByUserId).toHaveBeenCalledWith(999, db);
        });
    });

    // ── findByUserIdRaw ────────────────────────────────────────────────────────

    describe("findByUserIdRaw", () => {
        it("should return the raw wallet without kobo-to-NGN conversion", async () => {
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue({
                ...mockWallet,
                balance: 100000,
            });

            const result = await walletService.findByUserIdRaw(1);

            // Raw — balance stays in kobo
            expect(result.balance).toBe(100000);
        });

        it("should pass lock=true to the repository when locking is requested", async () => {
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue(mockWallet);
            const fakeTrx = {} as any;

            await walletService.findByUserIdRaw(1, fakeTrx, true);

            expect(walletRepository.findByUserId).toHaveBeenCalledWith(1, fakeTrx, true);
        });

        it("should throw APIError.NotFound (404) when wallet does not exist", async () => {
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue(undefined);

            await expect(walletService.findByUserIdRaw(999))
                .rejects.toMatchObject({ statusCode: 404, message: "Wallet not found" });
        });
    });

    // ── findSystemWallet ───────────────────────────────────────────────────────

    describe("findSystemWallet", () => {
        it("should return the system wallet when found", async () => {
            const systemWallet = {
                ...mockWallet,
                id: 99,
                user_id: null,
                wallet_type: WalletType.SYSTEM,
                balance: 1000000,
            };
            (walletRepository.findSystemWallet as jest.Mock).mockResolvedValue(systemWallet);

            const result = await walletService.findSystemWallet(WalletType.SYSTEM);

            expect(result).toEqual(systemWallet);
            expect(walletRepository.findSystemWallet).toHaveBeenCalledWith(WalletType.SYSTEM, db);
        });

        it("should return null when no system wallet exists for the given type", async () => {
            (walletRepository.findSystemWallet as jest.Mock).mockResolvedValue(null);

            const result = await walletService.findSystemWallet(WalletType.HOLDING);

            expect(result).toBeNull();
        });
    });

    // ── incrementBalance ───────────────────────────────────────────────────────

    describe("incrementBalance", () => {
        it("should delegate to the repository with the correct arguments", async () => {
            (walletRepository.incrementBalance as jest.Mock).mockResolvedValue(undefined);

            await walletService.incrementBalance(1, 5000);

            expect(walletRepository.incrementBalance).toHaveBeenCalledWith(1, 5000, db);
        });

        it("should forward a Knex transaction when provided", async () => {
            (walletRepository.incrementBalance as jest.Mock).mockResolvedValue(undefined);
            const fakeTrx = {} as any;

            await walletService.incrementBalance(1, 5000, fakeTrx);

            expect(walletRepository.incrementBalance).toHaveBeenCalledWith(1, 5000, fakeTrx);
        });

        it("should handle concurrent increments without interference", async () => {
            let total = 0;
            (walletRepository.incrementBalance as jest.Mock).mockImplementation(
                async (_id: number, amount: number) => { total += amount; }
            );

            await Promise.all(
                Array.from({ length: 50 }, () => walletService.incrementBalance(1, 1000))
            );

            expect(total).toBe(50000);
            expect(walletRepository.incrementBalance).toHaveBeenCalledTimes(50);
        });
    });

    // ── decrementBalance ───────────────────────────────────────────────────────

    describe("decrementBalance", () => {
        it("should delegate to the repository with the correct arguments", async () => {
            (walletRepository.decrementBalance as jest.Mock).mockResolvedValue(undefined);

            await walletService.decrementBalance(1, 3000);

            expect(walletRepository.decrementBalance).toHaveBeenCalledWith(1, 3000, db);
        });

        it("should forward a Knex transaction when provided", async () => {
            (walletRepository.decrementBalance as jest.Mock).mockResolvedValue(undefined);
            const fakeTrx = {} as any;

            await walletService.decrementBalance(1, 3000, fakeTrx);

            expect(walletRepository.decrementBalance).toHaveBeenCalledWith(1, 3000, fakeTrx);
        });

        it("should handle concurrent decrements without interference", async () => {
            let total = 20000;
            (walletRepository.decrementBalance as jest.Mock).mockImplementation(
                async (_id: number, amount: number) => { total -= amount; }
            );

            await Promise.all(
                Array.from({ length: 30 }, () => walletService.decrementBalance(1, 500))
            );

            expect(total).toBe(20000 - 30 * 500);
            expect(walletRepository.decrementBalance).toHaveBeenCalledTimes(30);
        });
    });
});