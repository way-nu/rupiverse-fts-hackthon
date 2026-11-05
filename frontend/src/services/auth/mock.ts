// Mock implementation of AuthApi: behaves like the backend (Spec §8) over the mock db. Mock mode only.
import {isPasswordTooLong, isValidEmail, passwordChecks, utf8Bytes} from "@/hooks/use-validation";
import {ApiError, type ApiErrorExtras} from "@/services/api-error";
import {mockControl, registerScenarios} from "@/services/mock/control";
import {table} from "@/services/mock/db";

import {errors, MOCK_CODE, type MockUser, scenarios, users} from "./fixtures";
import type {AuthApi, TokenPair, User} from "./types";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_MS = 60_000;
const MAX_ATTEMPTS = 3;
const RESET_TTL_MS = 10 * 60_000;

type Purpose = "verify" | "reset";
type CodeState = { sentAt: number; expiresAt: number; attempts: number; consumed: boolean };
type MockSession = { access: string; refresh: string; userId: string; revoked: boolean };
type AuthState = { users: MockUser[]; codes: Record<string, CodeState>; sessions: MockSession[] };
type PendingReset = { userId: string; expiresAt: number; used: boolean };

registerScenarios("auth", scenarios, errors);

const state = table<AuthState>("auth", () => ({
    users: [{...users.verified}, {...users.unverified}],
    codes: {},
    sessions: [],
}));
// Reset grants live in memory only: never persisted, so a reload of New password loses them (Spec §9).
const pendingResets = table<Record<string, PendingReset>>("pending", () => ({}), {persist: false});

let counter = 0;
const randomId = () => `${Date.now().toString(36)}-${(counter += 1).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const normalize = (email: string) => email.trim().toLowerCase();
const codeKey = (userId: string, purpose: Purpose) => `${userId}:${purpose}`;
const fail = (code: string, extras: ApiErrorExtras = {}) =>
    new ApiError(code, errors[code].status, errors[code].detail, {...errors[code].extras, ...extras});

async function gate(method: keyof typeof scenarios, extras: ApiErrorExtras = {}): Promise<void> {
    await mockControl.delay();
    const key = `auth.${method}`;
    const forced = mockControl.scenario(key);
    if (forced !== "ok") {
        throw mockControl.errorFor(key, forced, extras);
    }
}

function findUser(email: string): MockUser | undefined {
    const wanted = normalize(email);
    return state.get().users.find((u) => u.email === wanted);
}

function toUser(user: MockUser): User {
    return {id: user.id, email: user.email, is_verified: user.verified, created_at: user.created_at};
}

function checkPassword(password: string): void {
    if (utf8Bytes(password) < 8) {
        throw fail("password_too_short");
    }
    if (isPasswordTooLong(password)) {
        throw fail("password_too_long");
    }
    if (!Object.values(passwordChecks(password)).every(Boolean)) {
        throw fail("password_too_weak");
    }
}

function secondsUntilResend(userId: string, purpose: Purpose): number {
    const code = state.get().codes[codeKey(userId, purpose)];
    return code ? Math.max(0, Math.ceil((code.sentAt + RESEND_MS - Date.now()) / 1000)) : 0;
}

function sendCode(userId: string, purpose: Purpose): void {
    const now = Date.now();
    state.update((s) => {
        s.codes[codeKey(userId, purpose)] = {sentAt: now, expiresAt: now + CODE_TTL_MS, attempts: 0, consumed: false};
    });
}

function sendCodeUnlessRecent(userId: string, purpose: Purpose): void {
    if (secondsUntilResend(userId, purpose) === 0) {
        sendCode(userId, purpose);
    }
}

function consumeCode(user: MockUser | undefined, purpose: Purpose, code: string): void {
    const key = user ? codeKey(user.id, purpose) : "";
    const row = user ? state.get().codes[key] : undefined;
    if (!row || row.consumed) {
        throw fail("code_invalid", {attempts_remaining: MAX_ATTEMPTS - 1});
    }
    if (row.attempts >= MAX_ATTEMPTS) {
        throw fail("code_locked");
    }
    if (row.expiresAt <= Date.now()) {
        throw fail("code_expired");
    }
    if (code.trim() !== MOCK_CODE) {
        const attempts = row.attempts + 1;
        state.update((s) => {
            s.codes[key].attempts = attempts;
        });
        if (attempts >= MAX_ATTEMPTS) {
            throw fail("code_locked");
        }
        throw fail("code_invalid", {attempts_remaining: MAX_ATTEMPTS - attempts});
    }
    state.update((s) => {
        s.codes[key].consumed = true;
    });
}

function startSession(user: MockUser): TokenPair {
    const session: MockSession = {
        access: `mock-access-${randomId()}`,
        refresh: `mock-refresh-${randomId()}`,
        userId: user.id,
        revoked: false,
    };
    state.update((s) => {
        s.sessions.push(session);
    });
    return {
        access_token: session.access,
        refresh_token: session.refresh,
        token_type: "bearer",
        expires_in: 900,
        user: toUser(user),
    };
}

export const authMock: AuthApi = {
    async signup(body) {
        await gate("signup");
        const email = normalize(body.email);
        if (!isValidEmail(email)) {
            throw fail("invalid_email");
        }
        checkPassword(body.password);
        const existing = findUser(email);
        if (existing?.verified) {
            throw fail("email_taken");
        }
        if (existing) {
            state.update((s) => {
                s.users.find((u) => u.id === existing.id)!.password = body.password;
            });
            sendCodeUnlessRecent(existing.id, "verify");
        } else {
            const user: MockUser = {
                id: randomId(),
                email,
                password: body.password,
                verified: false,
                created_at: new Date().toISOString(),
            };
            state.update((s) => {
                s.users.push(user);
            });
            sendCode(user.id, "verify");
        }
        return {status: "verification_sent", email};
    },

    async verify(body) {
        await gate("verify");
        const user = findUser(body.email);
        if (user?.verified) {
            throw fail("already_verified");
        }
        consumeCode(user, "verify", body.code);
        state.update((s) => {
            s.users.find((u) => u.id === user!.id)!.verified = true;
        });
        return startSession(findUser(body.email)!);
    },

    async resend(body) {
        await gate("resend");
        const user = findUser(body.email);
        if (user?.verified) {
            throw fail("already_verified");
        }
        if (user) {
            const wait = secondsUntilResend(user.id, "verify");
            if (wait > 0) {
                throw fail("resend_too_soon", {retry_after_seconds: wait});
            }
            sendCode(user.id, "verify");
        }
        return {status: "verification_sent", retry_after_seconds: 60};
    },

    async login(body) {
        await gate("login", {email: normalize(body.email)});
        const user = findUser(body.email);
        if (!user || user.password !== body.password) {
            throw fail("invalid_credentials");
        }
        if (!user.verified) {
            sendCodeUnlessRecent(user.id, "verify");
            throw fail("email_not_verified", {email: user.email});
        }
        return startSession(user);
    },

    async refresh(body) {
        await gate("refresh");
        const session = state.get().sessions.find((s) => s.refresh === body.refresh_token && !s.revoked);
        const user = session && state.get().users.find((u) => u.id === session.userId);
        if (!session || !user) {
            throw fail("invalid_refresh_token");
        }
        state.update((s) => {
            s.sessions.find((x) => x.refresh === session.refresh)!.revoked = true;
        });
        return startSession(user);
    },

    async logout(body) {
        await gate("logout");
        state.update((s) => {
            s.sessions.filter((x) => x.refresh === body.refresh_token).forEach((x) => (x.revoked = true));
        });
    },

    async me(accessToken) {
        await gate("me");
        const session = state.get().sessions.find((s) => s.access === accessToken && !s.revoked);
        const user = session && state.get().users.find((u) => u.id === session.userId);
        if (!user) {
            throw fail("invalid_token");
        }
        return toUser(user);
    },

    async forgotPassword(body) {
        await gate("forgotPassword");
        if (!isValidEmail(body.email)) {
            throw fail("invalid_email");
        }
        const user = findUser(body.email);
        if (user) {
            sendCodeUnlessRecent(user.id, "reset");
        }
        return {status: "reset_code_sent", retry_after_seconds: 60};
    },

    async verifyResetCode(body) {
        await gate("verifyResetCode");
        const user = findUser(body.email);
        consumeCode(user, "reset", body.code);
        const grant = `mock-grant-${randomId()}`;
        pendingResets.update((p) => {
            p[grant] = {userId: user!.id, expiresAt: Date.now() + RESET_TTL_MS, used: false};
        });
        return {reset_token: grant, expires_in: RESET_TTL_MS / 1000};
    },

    async resetPassword(body) {
        await gate("resetPassword");
        checkPassword(body.new_password);
        const pending = pendingResets.get()[body.reset_token];
        if (!pending || pending.used || pending.expiresAt <= Date.now()) {
            throw fail("invalid_reset_token");
        }
        pendingResets.update((p) => {
            p[body.reset_token].used = true;
        });
        state.update((s) => {
            const user = s.users.find((u) => u.id === pending.userId)!;
            user.password = body.new_password;
            user.verified = true;
            s.sessions.filter((x) => x.userId === pending.userId).forEach((x) => (x.revoked = true));
        });
    },
};
