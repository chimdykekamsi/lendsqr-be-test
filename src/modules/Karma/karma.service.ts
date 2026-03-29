import { env } from "@/configs/env";
import axios from "axios";
import { KarmaCheckResponse } from "./karma.type";
import { winstonLogger } from "@/utils/logger";

export class KarmaService {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor() {
        this.baseUrl = env.ADJUTOR_BASE_URL;
        this.apiKey = env.ADJUTOR_API_KEY;
    }

    /**
     * Check if a user identity is on the Lendsqr Adjutor Karma blacklist.
     * Returns true if the identity IS blacklisted (should be denied onboarding).
     */
    async isBlacklisted(identity: string): Promise<boolean> {
        try {
            const response = await axios.get<KarmaCheckResponse>(
                `${this.baseUrl}/verification/karma/${encodeURIComponent(identity)}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 10_000,
                }
            );

            const { data } = response.data;

            // If data is null, identity is NOT on the karma blacklist
            if (!data) return false;

            return data.is_on_karma === true;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                // 404 means identity not found on blacklist → not blacklisted
                if (error.response?.status === 404) return false;

                winstonLogger.error(
                    `[KarmaService] API error (${error.response?.status}):`,
                    error.message
                );
            } else {
                winstonLogger.error("[KarmaService] Unexpected error:", error);
            }

            // Fail-open: if Adjutor is unreachable, log but allow (configurable)
            // For production you may want to fail-closed instead
            return false;
        }
    }
}

export const karmaService = new KarmaService();