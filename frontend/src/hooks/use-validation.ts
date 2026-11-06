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

// Profile fields (RV4 Spec §8): the same bounds the backend enforces. An empty value is always valid (it clears).
export const NAME_MIN = 3;
export const NAME_MAX = 80;
export const AGE_MIN = 18;
export const AGE_MAX = 120;
export const AGE_MAX_DIGITS = 3;
export const PHONE_DIGITS = 10;

export type ProfileField = "full_name" | "age" | "gender" | "phone";
export type AgeProblem = "under" | "invalid";

export const digitsOnly = (value: string): string => value.replace(/\D/g, "");

export function isValidName(value: string): boolean {
    const length = Array.from(value.trim()).length;
    return length === 0 || (length >= NAME_MIN && length <= NAME_MAX);
}

// Why an age is invalid: "under" 18 (design text "You must be 18 or older") or past 120 ("Enter a valid age").
export function ageProblem(value: string): AgeProblem | null {
    if (value === "") {
        return null;
    }
    const age = Number(value);
    if (!/^\d+$/.test(value) || age < AGE_MIN) {
        return "under";
    }
    return age > AGE_MAX ? "invalid" : null;
}

export function isValidPhone(value: string): boolean {
    return value === "" || new RegExp(`^[0-9]{${PHONE_DIGITS}}$`).test(value);
}
