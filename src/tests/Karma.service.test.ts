import { KarmaService } from "@/modules/Karma/karma.service";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("KarmaService", () => {
    let karmaService: KarmaService;

    beforeEach(() => {
        jest.clearAllMocks();
        karmaService = new KarmaService();
        mockedAxios.isAxiosError.mockImplementation((payload: Record<string, unknown>): payload is Record<string, unknown> => true);
    });

    it("should return true when identity is on the blacklist", async () => {
        mockedAxios.get.mockResolvedValue({
            data: {
                status: "success",
                message: "Identity found",
                data: {
                    karma_identity: "blacklisted@example.com",
                    amount_in_contention: "100000",
                    reason: "Fraud",
                    default_date: "2024-01-01",
                    is_on_karma: true,
                },
            },
        });

        const result = await karmaService.isBlacklisted("blacklisted@example.com");
        expect(result).toBe(true);
    });

    it("should return false when identity is NOT on the blacklist", async () => {
        mockedAxios.get.mockResolvedValue({
            data: {
                status: "success",
                message: "Identity not found",
                data: null,
            },
        });

        const result = await karmaService.isBlacklisted("clean@example.com");
        expect(result).toBe(false);
    });

    it("should return false when API returns 404 (not found on blacklist)", async () => {
        const error = { response: { status: 404 }, message: "Not Found" };
        mockedAxios.get.mockRejectedValue(error);
        mockedAxios.isAxiosError.mockReturnValue(true);

        const result = await karmaService.isBlacklisted("unknown@example.com");
        expect(result).toBe(false);
    });

    it("should return false (fail-open) when the Adjutor API is unreachable", async () => {
        mockedAxios.get.mockRejectedValue(new Error("Network Error"));
        mockedAxios.isAxiosError.mockReturnValue(false);

        const result = await karmaService.isBlacklisted("user@example.com");
        expect(result).toBe(false);
    });

    it("should return false when is_on_karma is explicitly false", async () => {
        mockedAxios.get.mockResolvedValue({
            data: {
                status: "success",
                data: {
                    karma_identity: "user@example.com",
                    amount_in_contention: "0",
                    reason: "",
                    default_date: "",
                    is_on_karma: false,
                },
            },
        });

        const result = await karmaService.isBlacklisted("user@example.com");
        expect(result).toBe(false);
    });
});