// Client-side input rules, mirroring the backend (Spec §5): email shape, 8-72 UTF-8 bytes, upper/lower/digit/special.

export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_BYTES = 8;

export type PasswordRuleKey = "length" | "upper" | "lower" | "number" | "special";

export const PASSWORD_RULES: { key: PasswordRuleKey; label: string }[] = [
    {key: "length", label: "8+ characters"},
    {key: "upper", label: "1 uppercase"},
    {key: "lower", label: "1 lowercase"},
    {key: "number", label: "1 number"},
    {key: "special", label: "1 special char"},
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
    return EMAIL.test(value.trim());
}

export function utf8Bytes(value: string): number {
    return new TextEncoder().encode(value).length;
}

export function passwordChecks(password: string): Record<PasswordRuleKey, boolean> {
    return {
        length: utf8Bytes(password) >= PASSWORD_MIN_BYTES,
        upper: /\p{Lu}/u.test(password),
        lower: /\p{Ll}/u.test(password),
        number: /\p{Nd}/u.test(password),
        special: /[^\p{L}\p{N}]/u.test(password),
    };
}

export function isPasswordTooLong(password: string): boolean {
    return utf8Bytes(password) > PASSWORD_MAX_BYTES;
}

export function isPasswordValid(password: string): boolean {
    return !isPasswordTooLong(password) && Object.values(passwordChecks(password)).every(Boolean);
}
