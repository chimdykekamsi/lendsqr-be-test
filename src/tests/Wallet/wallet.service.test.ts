import { walletService } from "@/modules/Wallet/wallet.service";
import { walletRepository } from "@/modules/Wallet/wallet.repo";
import { testDB as db } from "@/configs/db";
import { WalletType } from "@/modules/Wallet/wallet.type";

// Mock dependencies
jest.mock("@/modules/Wallet/wallet.repo");
jest.mock("@/modules/User/user.repo");
jest.mock("@/modules/Karma/karma.service");

describe("WalletService", () => {
    const mockWalletData = {
        user_id: 1,
        wallet_type: WalletType.MAIN
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createWallet", () => {
        it("should create a wallet successfully", async () => {
            // Mock repository.create to return an id
            (walletRepository.create as jest.Mock).mockResolvedValue(1);

            // Mock repository.findById to return the created wallet
            (walletRepository.findById as jest.Mock).mockResolvedValue({
                id: 1,
                user_id: 1,
                wallet_type: WalletType.MAIN,
                balance: 0,
                created_at: new Date(),
                updated_at: new Date()
            });



            const result = await walletService.createWallet(
                mockWalletData.user_id,
                mockWalletData.wallet_type
            );

            expect(result).toEqual({
                id: 1,
                user_id: 1,
                wallet_type: WalletType.MAIN,
                balance: 0,
                created_at: expect.any(Date),
                updated_at: expect.any(Date)
            });

            expect(walletRepository.create).toHaveBeenCalledWith(
                { user_id: 1, wallet_type: WalletType.MAIN },
                db
            );
            expect(walletRepository.findById).toHaveBeenCalledWith(1, db);
        });

        it("should throw error when wallet creation fails", async () => {
            // Mock repository.create to return null (failure)
            (walletRepository.create as jest.Mock).mockResolvedValue(null);



            await expect(
                walletService.createWallet(
                    mockWalletData.user_id,
                    mockWalletData.wallet_type
                )
            ).rejects.toThrow("Failed to create wallet");

            expect(walletRepository.create).toHaveBeenCalledWith(
                { user_id: 1, wallet_type: WalletType.MAIN },
                db
            );
        });
    });

    describe("findByUserId", () => {
        it("should return wallet by user id successfully", async () => {
            const userId = 1;

            // Mock repository.findByUserId to return a wallet
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue({
                id: 1,
                user_id: 1,
                wallet_type: WalletType.MAIN,
                balance: 100000, // 1000 in smallest currency unit
                created_at: new Date(),
                updated_at: new Date()
            });



            const result = await walletService.findByUserId(userId);

            expect(result).toEqual({
                id: 1,
                user_id: 1,
                wallet_type: WalletType.MAIN,
                balance: 1000, // Converted from smallest currency unit
                created_at: expect.any(Date),
                updated_at: expect.any(Date)
            });

            expect(walletRepository.findByUserId).toHaveBeenCalledWith(userId, db);
        });

        it("should throw error when wallet not found", async () => {
            const userId = 999;

            // Mock repository.findByUserId to return undefined (not found)
            (walletRepository.findByUserId as jest.Mock).mockResolvedValue(undefined);



            await expect(walletService.findByUserId(userId))
                .rejects
                .toThrow("Wallet not found");

            expect(walletRepository.findByUserId).toHaveBeenCalledWith(userId, db);
        });
    });

    describe("incrementBalance", () => {
        it("should increment wallet balance successfully", async () => {
            const walletId = 1;
            const amount = 5000; // 50 in smallest currency unit

            // Mock repository.incrementBalance to resolve
            (walletRepository.incrementBalance as jest.Mock).mockResolvedValue(undefined);



            await walletService.incrementBalance(walletId, amount);

            expect(walletRepository.incrementBalance).toHaveBeenCalledWith(
                walletId,
                amount,
                db
            );
        });
    });

    describe("decrementBalance", () => {
        it("should decrement wallet balance successfully", async () => {
            const walletId = 1;
            const amount = 3000; // 30 in smallest currency unit

            // Mock repository.decrementBalance to resolve
            (walletRepository.decrementBalance as jest.Mock).mockResolvedValue(undefined);



            await walletService.decrementBalance(walletId, amount);

            expect(walletRepository.decrementBalance).toHaveBeenCalledWith(
                walletId,
                amount,
                db
            );
        });
    });

    describe("findSystemWallet", () => {
        it("should return system wallet when found", async () => {
            const walletType = WalletType.SYSTEM;

            // Mock repository.findSystemWallet to return a wallet
            (walletRepository.findSystemWallet as jest.Mock).mockResolvedValue({
                id: 1,
                user_id: null,
                wallet_type: WalletType.SYSTEM,
                balance: 1000000,
                created_at: new Date(),
                updated_at: new Date()
            });



            const result = await walletService.findSystemWallet(walletType);

            expect(result).toEqual({
                id: 1,
                user_id: null,
                wallet_type: WalletType.SYSTEM,
                balance: 1000000,
                created_at: expect.any(Date),
                updated_at: expect.any(Date)
            });

            expect(walletRepository.findSystemWallet).toHaveBeenCalledWith(
                walletType,
                db
            );
        });

        it("should return null when system wallet not found", async () => {
            const walletType = WalletType.SYSTEM;

            // Mock repository.findSystemWallet to return null (not found)
            (walletRepository.findSystemWallet as jest.Mock).mockResolvedValue(null);



            const result = await walletService.findSystemWallet(walletType);

            expect(result).toBeNull();

            expect(walletRepository.findSystemWallet).toHaveBeenCalledWith(
                walletType,
                db
            );
        });
    });

    describe("race condition tests", () => {
        it("should handle concurrent balance increments correctly", async () => {
            const walletId = 1;
            const incrementAmount = 1000; // 10 NGN
            const concurrentOperations = 50;

            // Mock repository.incrementBalance to track calls
            let balance = 0;
            (walletRepository.incrementBalance as jest.Mock).mockImplementation(async (id, amount, database) => {
                balance += amount;
                return Promise.resolve();
            });



            // Execute concurrent increment operations
            const promises = [];
            for (let i = 0; i < concurrentOperations; i++) {
                promises.push(walletService.incrementBalance(walletId, incrementAmount));
            }

            await Promise.all(promises);

            // Verify final balance is correct
            expect(balance).toBe(incrementAmount * concurrentOperations);
            expect(walletRepository.incrementBalance).toHaveBeenCalledTimes(concurrentOperations);
        });

        it("should handle concurrent balance decrements correctly", async () => {
            const walletId = 1;
            const decrementAmount = 500; // 5 NGN
            const concurrentOperations = 30;
            let balance = 20000; // Starting balance of 200 NGN

            // Mock repository.decrementBalance to track calls
            (walletRepository.decrementBalance as jest.Mock).mockImplementation(async (id, amount, database) => {
                balance -= amount;
                return Promise.resolve();
            });



            // Execute concurrent decrement operations
            const promises = [];
            for (let i = 0; i < concurrentOperations; i++) {
                promises.push(walletService.decrementBalance(walletId, decrementAmount));
            }

            await Promise.all(promises);

            // Verify final balance is correct
            expect(balance).toBe(20000 - (decrementAmount * concurrentOperations));
            expect(walletRepository.decrementBalance).toHaveBeenCalledTimes(concurrentOperations);
        });
    });
});