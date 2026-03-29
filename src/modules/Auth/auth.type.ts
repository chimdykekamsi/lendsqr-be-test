
export interface JwtPayload {
    user_id: number;
    email: string;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedRequest extends Express.Request {
    user: JwtPayload;
}