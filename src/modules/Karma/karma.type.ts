export interface KarmaCheckResponse {
    status: string;
    message: string;
    data: {
        karma_identity: string;
        amount_in_contention: string;
        reason: string;
        default_date: string;
        is_on_karma: boolean;
    } | null;
}