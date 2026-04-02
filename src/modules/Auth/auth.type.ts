import z from "zod";

export interface JwtPayload {
    user_id: number;
    email: string;
    iat?: number;
    exp?: number;
}


export const createUserSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format, must be in E.164 format")
        .optional(),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
});