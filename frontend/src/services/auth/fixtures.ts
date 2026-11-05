// Typed fixtures and named scenarios for every auth endpoint (Spec §8). Mock mode only.
import type {ErrorSpec} from "@/services/mock/control";

import type {TokenPair} from "./types";

export const MOCK_CODE = "123456";

export type MockUser = { id: string; email: string; password: string; verified: boolean; created_at: string };

export const users: Record<"verified" | "unverified", MockUser> = {
    verified: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "demo@rupiverse.app",
        password: "Demo@1234",
        verified: true,
        created_at: "2026-11-01T09:00:00Z",
    },
    unverified: {
        id: "00000000-0000-4000-8000-000000000002",
        email: "new@rupiverse.app",
        password: "Demo@1234",
        verified: false,
        created_at: "2026-11-02T09:00:00Z",
    },
};

export const tokens: TokenPair = {
    access_token: "mock-access",
    refresh_token: "mock-refresh",
    token_type: "bearer",
    expires_in: 900,
    user: {
        id: users.verified.id,
        email: users.verified.email,
        is_verified: true,
        created_at: users.verified.created_at,
    },
};

// Every error code §8 lists per endpoint (`ok` and `network_error` are added by mockControl).
export const scenarios = {
    signup: ["invalid_email", "password_too_short", "password_too_long", "password_too_weak", "email_taken",
        "email_send_failed"],
    verify: ["code_invalid", "code_locked", "code_expired", "already_verified"],
    resend: ["resend_too_soon", "already_verified", "email_send_failed"],
    login: ["invalid_credentials", "email_not_verified"],
    refresh: ["invalid_refresh_token"],
    logout: [],
    me: ["not_authenticated", "token_expired", "invalid_token"],
    forgotPassword: ["invalid_email", "email_send_failed"],
    verifyResetCode: ["code_invalid", "code_locked", "code_expired"],
    resetPassword: ["invalid_reset_token", "password_too_short", "password_too_long", "password_too_weak"],
} as const;

export const errors: Record<string, ErrorSpec> = {
    invalid_email: {status: 422, detail: "Enter a valid email address."},
    password_too_short: {status: 422, detail: "Password must be at least 8 bytes."},
    password_too_long: {status: 422, detail: "Password is too long (max 72 bytes)."},
    password_too_weak: {status: 422, detail: "Password needs at least one uppercase letter."},
    email_taken: {status: 409, detail: "An account with this email already exists."},
    email_send_failed: {status: 502, detail: "We couldn't send the email."},
    already_verified: {status: 409, detail: "This email is already verified."},
    code_invalid: {status: 400, detail: "That code is not right.", extras: {attempts_remaining: 2}},
    code_locked: {status: 400, detail: "Too many wrong attempts."},
    code_expired: {status: 400, detail: "This code has expired."},
    resend_too_soon: {status: 429, detail: "Wait before requesting another code.", extras: {retry_after_seconds: 42}},
    invalid_credentials: {status: 401, detail: "Wrong email or password."},
    email_not_verified: {status: 403, detail: "Verify your email to continue."},
    invalid_refresh_token: {status: 401, detail: "Your session has ended."},
    not_authenticated: {status: 401, detail: "Sign in to continue."},
    token_expired: {status: 401, detail: "Your session has expired."},
    invalid_token: {status: 401, detail: "Your session is not valid."},
    invalid_reset_token: {status: 400, detail: "This reset link has expired."},
};
