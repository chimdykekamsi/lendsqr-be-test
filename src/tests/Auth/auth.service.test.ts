import { AuthService } from "@/modules/Auth/auth.service";
import db from "@/configs/db";
import jwt from "jsonwebtoken";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// AuthService.login calls db<UserRow>("users").where({ email }).first() directly
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

const buildDbQueryChain = (resolvedValue: unknown) => ({
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(resolvedValue),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthService", () => {
    let authService: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        authService = new AuthService();
    });

    // ── generateToken ──────────────────────────────────────────────────────────

    describe("generateToken", () => {
        it("should return a properly structured JWT string", () => {
            const token = authService.generateToken(mockUser);

            expect(typeof token).toBe("string");
            // JWT format: header.payload.signature
            expect(token.split(".")).toHaveLength(3);
        });

        it("should embed user_id and email in the token payload", () => {
            const token = authService.generateToken(mockUser);
            const decoded = jwt.decode(token) as { user_id: number; email: string };

            expect(decoded.user_id).toBe(mockUser.id);
            expect(decoded.email).toBe(mockUser.email);
        });

        it("should generate distinct tokens for different users", () => {
            const otherUser = { ...mockUser, id: 2, email: "other@example.com" };
            const token1 = authService.generateToken(mockUser);
            const token2 = authService.generateToken(otherUser);

            expect(token1).not.toBe(token2);
        });
    });

    // ── verifyToken ────────────────────────────────────────────────────────────

    describe("verifyToken", () => {
        it("should return the decoded payload for a valid token", () => {
            const token = authService.generateToken(mockUser);
            const payload = authService.verifyToken(token);

            expect(payload.user_id).toBe(mockUser.id);
            expect(payload.email).toBe(mockUser.email);
        });

        it("should throw for a malformed / garbage token", () => {
            expect(() => authService.verifyToken("this.is.garbage")).toThrow();
        });

        it("should throw for a token signed with the wrong secret", () => {
            const forgery = jwt.sign({ user_id: 1, email: "x@x.com" }, "wrong-secret");
            expect(() => authService.verifyToken(forgery)).toThrow();
        });
    });

    // ── login ──────────────────────────────────────────────────────────────────

    describe("login", () => {
        it("should throw NotFound when no user exists for the given email", async () => {
            (db as any).mockReturnValue(buildDbQueryChain(undefined));

            await expect(authService.login("ghost@example.com"))
                .rejects.toThrow("User not found");
        });

        it("should return a token and user object on successful login", async () => {
            (db as any).mockReturnValue(buildDbQueryChain(mockUser));

            const result = await authService.login(mockUser.email);

            expect(result).toHaveProperty("user", mockUser);
            expect(result).toHaveProperty("token");
            expect(typeof result.token).toBe("string");
            expect(result.token.split(".")).toHaveLength(3);
        });

        it("should return a token whose payload matches the logged-in user", async () => {
            (db as any).mockReturnValue(buildDbQueryChain(mockUser));

            const { token } = await authService.login(mockUser.email);
            const decoded = jwt.decode(token) as { user_id: number; email: string };

            expect(decoded.user_id).toBe(mockUser.id);
            expect(decoded.email).toBe(mockUser.email);
        });

        it("should query the users table using the provided email", async () => {
            const chain = buildDbQueryChain(mockUser);
            (db as any).mockReturnValue(chain);

            await authService.login(mockUser.email);

            expect(chain.where).toHaveBeenCalledWith({ email: mockUser.email });
        });
    });
});