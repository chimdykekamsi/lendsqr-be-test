import { UserService } from "@/modules/User/user.service";
import { userRepository } from "@/modules/User/user.repo";
import { karmaService } from "@/modules/Karma/karma.service";
import { walletService } from "@/modules/Wallet/wallet.service";
import { WalletType } from "@/modules/Wallet/wallet.type";
import db from "@/configs/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/modules/User/user.repo", () => ({
    userRepository: {
        findByEmail: jest.fn(),
        findById: jest.fn(),
        create: jest.fn(),
    },
}));

jest.mock("@/modules/Karma/karma.service", () => ({
    karmaService: {
        isBlacklisted: jest.fn(),
    },
}));

jest.mock("@/modules/Wallet/wallet.service", () => ({
    walletService: {
        createWallet: jest.fn(),
        findByUserId: jest.fn(),
        findByUserIdRaw: jest.fn(),
    },
}));

jest.mock("@/configs/db", () => {
    const mockDb = jest.fn();
    (mockDb as any).transaction = jest.fn();
    return { __esModule: true, default: mockDb };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
    id: 1,
    name: "Chimdike Anagboso",
    email: "chimdike@example.com",
    phone: "+2348012345678",
    created_at: new Date(),
    updated_at: new Date(),
};

const mockWallet = {
    id: 1,
    user_id: 1,
    wallet_type: WalletType.MAIN,
    balance: 0,
    created_at: new Date(),
    updated_at: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UserService", () => {
    let userService: UserService;

    beforeEach(() => {
        jest.clearAllMocks();
        userService = new UserService();
    });

    // ── createUser ─────────────────────────────────────────────────────────────

    describe("createUser", () => {
        const dto = {
            name: "Chimdike Anagboso",
            email: "chimdike@example.com",
            phone: "+2348012345678",
        };

        it("should throw Conflict when email already exists", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(mockUser);

            await expect(userService.createUser(dto))
                .rejects.toThrow("A user with this email already exists");

            expect(userRepository.findByEmail).toHaveBeenCalledWith(dto.email);
            // Must not proceed to karma check
            expect(karmaService.isBlacklisted).not.toHaveBeenCalled();
        });

        it("should throw when email is on the Karma blacklist", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(undefined);
            // email blacklisted, phone passes
            (karmaService.isBlacklisted as jest.Mock)
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            // The service throws a plain Error here (not APIError) — match the exact message
            await expect(userService.createUser(dto))
                .rejects.toThrow("User cannot be onboarded due to compliance restrictions");

            // Must not proceed to db.transaction
            expect(db.transaction).not.toHaveBeenCalled();
        });

        it("should throw when phone is on the Karma blacklist", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(undefined);
            // email passes, phone blacklisted
            (karmaService.isBlacklisted as jest.Mock)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            await expect(userService.createUser(dto))
                .rejects.toThrow("User cannot be onboarded due to compliance restrictions");

            expect(db.transaction).not.toHaveBeenCalled();
        });

        it("should only run one karma check when no phone is provided", async () => {
            const dtoWithoutPhone = { name: "Chimdike", email: "chimdike@example.com" };

            (userRepository.findByEmail as jest.Mock).mockResolvedValue(undefined);
            (karmaService.isBlacklisted as jest.Mock).mockResolvedValue(false);
            (userRepository.create as jest.Mock).mockResolvedValue(1);
            (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
            (walletService.createWallet as jest.Mock).mockResolvedValue(mockWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await userService.createUser(dtoWithoutPhone);

            // phone is undefined — only one karma call (email)
            expect(karmaService.isBlacklisted).toHaveBeenCalledTimes(1);
            expect(karmaService.isBlacklisted).toHaveBeenCalledWith(dtoWithoutPhone.email);
        });

        it("should throw Internal when repository.create returns null", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(undefined);
            (karmaService.isBlacklisted as jest.Mock).mockResolvedValue(false);
            (userRepository.create as jest.Mock).mockResolvedValue(null);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(userService.createUser(dto))
                .rejects.toThrow("Failed to create user");
        });

        it("should throw Internal when findById returns null after user creation", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(undefined);
            (karmaService.isBlacklisted as jest.Mock).mockResolvedValue(false);
            (userRepository.create as jest.Mock).mockResolvedValue(1);
            (walletService.createWallet as jest.Mock).mockResolvedValue(mockWallet);
            // Wallet created fine but user cannot be retrieved
            (userRepository.findById as jest.Mock).mockResolvedValue(null);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            await expect(userService.createUser(dto))
                .rejects.toThrow("Failed to retrieve created user");
        });

        it("should create user and MAIN wallet atomically when all checks pass", async () => {
            (userRepository.findByEmail as jest.Mock).mockResolvedValue(undefined);
            (karmaService.isBlacklisted as jest.Mock).mockResolvedValue(false);
            (userRepository.create as jest.Mock).mockResolvedValue(1);
            (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
            (walletService.createWallet as jest.Mock).mockResolvedValue(mockWallet);

            const trxMock = jest.fn();
            (db.transaction as jest.Mock).mockImplementation(async (cb: Function) => cb(trxMock));

            const result = await userService.createUser(dto);

            expect(result).toEqual(mockUser);
            expect(userRepository.create).toHaveBeenCalledWith(
                { name: dto.name, email: dto.email, phone: dto.phone },
                trxMock
            );
            expect(walletService.createWallet).toHaveBeenCalledWith(1, WalletType.MAIN, trxMock);
            expect(userRepository.findById).toHaveBeenCalledWith(1, trxMock);
        });
    });

    // ── getUserWithWallet ──────────────────────────────────────────────────────

    describe("getUserWithWallet", () => {
        it("should throw NotFound when user does not exist", async () => {
            (userRepository.findById as jest.Mock).mockResolvedValue(undefined);

            await expect(userService.getUserWithWallet(999))
                .rejects.toThrow("User not found");

            // Must not reach wallet lookup
            expect(walletService.findByUserId).not.toHaveBeenCalled();
        });

        it("should return user merged with wallet on success", async () => {
            (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
            (walletService.findByUserId as jest.Mock).mockResolvedValue(mockWallet);

            const result = await userService.getUserWithWallet(1);

            expect(result).toEqual({ ...mockUser, wallet: mockWallet });
            expect(userRepository.findById).toHaveBeenCalledWith(1);
            expect(walletService.findByUserId).toHaveBeenCalledWith(1);
        });

        it("should propagate error when walletService throws", async () => {
            (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
            (walletService.findByUserId as jest.Mock).mockRejectedValue(
                new Error("Wallet not found")
            );

            await expect(userService.getUserWithWallet(1))
                .rejects.toThrow("Wallet not found");
        });
    });
});