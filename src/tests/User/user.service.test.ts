import { userService } from "@/modules/User/user.service";
import { userRepository } from "@/modules/User/user.repo";
import { karmaService } from "@/modules/Karma/karma.service";
import { walletService } from "@/modules/Wallet/wallet.service";
import { APIError } from "@/utils/APIError";
import { testDB as db } from "@/configs/db";

// Mock dependencies
jest.mock("@/modules/User/user.repo");
jest.mock("@/modules/Karma/karma.service");
jest.mock("@/modules/Wallet/wallet.service");

describe("UserService", () => {
    const mockCreateUserDTO = {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890"
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createUser", () => {
        it("should create a user successfully when email doesn't exist and not blacklisted", async () => {
            // Mock repository.findByEmail to return null (no existing user)
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

            // Mock karmaService.isBlacklisted to return false for both email and phone
            (karmaService.isBlacklisted as jest.Mock).mockResolvedValue(false);

            // Mock repository.create to return a userId
            (userRepository.create as jest.Mock).mockResolvedValue(1);

            // Mock walletService.createWallet to resolve
            (walletService.createWallet as jest.Mock).mockResolvedValue({ id: 1, user_id: 1, wallet_type: "MAIN", balance: 0 });

            // Mock repository.findById to return the created user
            (userRepository.findById as jest.Mock).mockResolvedValue({
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                phone: "1234567890",
                blacklisted: false,
                created_at: new Date(),
                updated_at: new Date()
            });



            const result = await userService.createUser(mockCreateUserDTO);

            expect(result).toEqual({
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                phone: "1234567890",
                blacklisted: false,
                created_at: expect.any(Date),
                updated_at: expect.any(Date)
            });

            expect(userRepository.findByEmail).toHaveBeenCalledWith("john@example.com");
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("john@example.com");
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("1234567890");
            expect(userRepository.create).toHaveBeenCalledWith({
                name: "John Doe",
                email: "john@example.com",
                phone: "1234567890"
            }, db);
            expect(walletService.createWallet).toHaveBeenCalledWith(1, "MAIN", db);
            expect(userRepository.findById).toHaveBeenCalledWith(1, db);
        });

        it("should throw Conflict error when email already exists", async () => {
            // Mock repository.findByEmail to return an existing user
            (userRepository.findByEmail as jest.Mock).mockResolvedValue({
                id: 1,
                email: "john@example.com"
            });

            await expect(userService.createUser(mockCreateUserDTO))
                .rejects
                .toThrow(APIError.Conflict("A user with this email already exists"));

            expect(userRepository.findByEmail).toHaveBeenCalledWith("john@example.com");
        });

        it("should throw error when user is blacklisted via email", async () => {
            // Mock repository.findByEmail to return null (no existing user)
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

            // Mock karmaService.isBlacklisted to return true for email
            (karmaService.isBlacklisted as jest.Mock)
                .mockResolvedValueOnce(true)  // email blacklisted
                .mockResolvedValueOnce(false); // phone not blacklisted

            await expect(userService.createUser(mockCreateUserDTO))
                .rejects
                .toThrow("User cannot be onboarded due to compliance restrictions");

            expect(userRepository.findByEmail).toHaveBeenCalledWith("john@example.com");
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("john@example.com");
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("1234567890");
        });

        it("should throw error when user is blacklisted via phone", async () => {
            // Mock repository.findByEmail to return null (no existing user)
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

            // Mock karmaService.isBlacklisted to return false for email, true for phone
            (karmaService.isBlacklisted as jest.Mock)
                .mockResolvedValueOnce(false)  // email not blacklisted
                .mockResolvedValueOnce(true);  // phone blacklisted

            await expect(userService.createUser(mockCreateUserDTO))
                .rejects
                .toThrow("User cannot be onboarded due to compliance restrictions");

            expect(userRepository.findByEmail).toHaveBeenCalledWith("john@example.com");
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("john@example.com");
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("1234567890");
        });

        it("should handle phone being undefined", async () => {
            const dtoWithoutPhone = {
                name: "John Doe",
                email: "john@example.com"
            };

            // Mock repository.findByEmail to return null (no existing user)
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

            // Mock karmaService.isBlacklisted to return false for email
            (karmaService.isBlacklisted as jest.Mock).mockResolvedValue(false);

            // Mock repository.create to return a userId
            (userRepository.create as jest.Mock).mockResolvedValue(1);

            // Mock walletService.createWallet to resolve
            (walletService.createWallet as jest.Mock).mockResolvedValue({ id: 1, user_id: 1, wallet_type: "MAIN", balance: 0 });

            // Mock repository.findById to return the created user
            (userRepository.findById as jest.Mock).mockResolvedValue({
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                phone: null,
                blacklisted: false,
                created_at: new Date(),
                updated_at: new Date()
            });



            await userService.createUser(dtoWithoutPhone);

            expect(karmaService.isBlacklisted).toHaveBeenCalledWith("john@example.com");
        });
    });

    describe("getUserWithWallet", () => {
        it("should return user with wallet when user exists", async () => {
            const userId = 1;

            // Mock repository.findById to return a user
            (userRepository.findById as jest.Mock).mockResolvedValue({
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                phone: "1234567890",
                blacklisted: false,
                created_at: new Date(),
                updated_at: new Date()
            });

            // Mock walletService.findByUserId to return a wallet
            (walletService.findByUserId as jest.Mock).mockResolvedValue({
                id: 1,
                user_id: 1,
                wallet_type: "MAIN",
                balance: 1000,
                created_at: new Date(),
                updated_at: new Date()
            });

            const result = await userService.getUserWithWallet(userId);

            expect(result).toEqual({
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                phone: "1234567890",
                blacklisted: false,
                created_at: expect.any(Date),
                updated_at: expect.any(Date),
                wallet: {
                    id: 1,
                    user_id: 1,
                    wallet_type: "MAIN",
                    balance: 1000,
                    created_at: expect.any(Date),
                    updated_at: expect.any(Date)
                }
            });

            expect(userRepository.findById).toHaveBeenCalledWith(userId);
            expect(walletService.findByUserId).toHaveBeenCalledWith(userId);
        });

        it("should throw NotFound error when user doesn't exist", async () => {
            const userId = 999;

            // Mock repository.findById to return null (user not found)
            (userRepository.findById as jest.Mock).mockResolvedValue(null);

            await expect(userService.getUserWithWallet(userId))
                .rejects
                .toThrow(APIError.NotFound("User not found"));

            expect(userRepository.findById).toHaveBeenCalledWith(userId);
        });
    });
});