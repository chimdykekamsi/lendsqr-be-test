import crypto from "crypto";
import { uuid } from "uuidv4";

export const generateReference = (prefix: string): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuid().replace(/-/g, "").substring(0, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

// ─── Hashing ─────────────────────────────────────────────────────────────────

export const hashObject = (obj: unknown): string => {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(obj))
        .digest("hex");
};