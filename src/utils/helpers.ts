import crypto from "crypto";
import { uuid } from "uuidv4";

export const formatPhoneNumber = (phoneNumber: string, code: string): string => {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.startsWith(code)) {
        return `+${digits}`;
    }
    // if starts with 0, remove the 0 and add country code
    if (digits.startsWith('0')) {
        return `+${code}${digits.substring(1)}`;
    }
    return `+${code}${digits}`;
}

export const generateCode = (length: number = 6): string => {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += Math.floor(Math.random() * 10).toString();
    }
    return code;
}

export const slugify = (value: string) =>
    value.toLowerCase().trim().replace(/\s+/g, "_");

// ─── Reference Generation ────────────────────────────────────────────────────

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

// ─── Amount Validation ───────────────────────────────────────────────────────

export const isValidAmount = (amount: number): boolean => {
    return Number.isInteger(amount) && amount > 0;
};

export const toNaira = (kobo: number): string => {
    return `₦${(kobo / 100).toFixed(2)}`;
};
