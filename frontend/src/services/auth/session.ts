// What hooks call as `api.auth`: the transport (live or mock) plus token handling, identical in both modes.
// Tokens are stored after verify/login, cleared on logout (even if the call fails) and after a password reset.
// An authed call that gets a 401 tries one refresh and retries once; if that fails the session ends.
import {ApiError} from "@/services/api-error";
import {clearTokens, readTokens, writeTokens} from "@/services/auth-storage";

import type {
    AuthApi,
    EmailRequest,
    LoginRequest,
    ResendResponse,
    ResetCodeSentResponse,
    ResetCodeVerifyRequest,
    ResetPasswordRequest,
    ResetTokenResponse,
    SignupRequest,
    TokenPair,
    User,
    VerificationSentResponse,
    VerifyRequest,
} from "./types";

export type SessionStatus = "signedIn" | "signedOut";
type Listener = (status: SessionStatus) => void;

export type AuthClient = {
    signup(body: SignupRequest): Promise<VerificationSentResponse>;
    verify(body: VerifyRequest): Promise<User>;
    resend(body: EmailRequest): Promise<ResendResponse>;
    login(body: LoginRequest): Promise<User>;
    logout(): Promise<void>;
    me(): Promise<User>;
    forgotPassword(body: EmailRequest): Promise<ResetCodeSentResponse>;
    verifyResetCode(body: ResetCodeVerifyRequest): Promise<ResetTokenResponse>;
    resetPassword(body: ResetPasswordRequest): Promise<void>;
    sessionStatus(): Promise<SessionStatus>;
    subscribe(listener: Listener): () => void;
};

export function createAuthClient(transport: AuthApi): AuthClient {
    const listeners = new Set<Listener>();
    const emit = (status: SessionStatus) => listeners.forEach((listener) => listener(status));

    async function startSession(pair: TokenPair): Promise<User> {
        await writeTokens({accessToken: pair.access_token, refreshToken: pair.refresh_token});
        emit("signedIn");
        return pair.user;
    }

    async function endSession(): Promise<void> {
        await clearTokens();
        emit("signedOut");
    }

    async function authed<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
        const tokens = await readTokens();
        if (!tokens) {
            await endSession();
            throw new ApiError("not_authenticated", 401, "Sign in to continue.");
        }
        try {
            return await call(tokens.accessToken);
        } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 401) {
                throw error;
            }
        }
        let pair: TokenPair;
        try {
            pair = await transport.refresh({refresh_token: tokens.refreshToken});
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                await endSession();
            }
            throw error;
        }
        await writeTokens({accessToken: pair.access_token, refreshToken: pair.refresh_token});
        try {
            return await call(pair.access_token);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                await endSession();
            }
            throw error;
        }
    }

    return {
        signup: (body) => transport.signup(body),
        verify: async (body) => startSession(await transport.verify(body)),
        resend: (body) => transport.resend(body),
        login: async (body) => startSession(await transport.login(body)),
        async logout() {
            // Sign out locally first, so it holds even if the app reloads or the server can't be reached.
            const tokens = await readTokens();
            await endSession();
            if (tokens) {
                await transport.logout({refresh_token: tokens.refreshToken}).catch(() => undefined);
            }
        },
        me: () => authed((accessToken) => transport.me(accessToken)),
        forgotPassword: (body) => transport.forgotPassword(body),
        verifyResetCode: (body) => transport.verifyResetCode(body),
        async resetPassword(body) {
            await transport.resetPassword(body);
            await endSession();
        },
        async sessionStatus() {
            return (await readTokens()) ? "signedIn" : "signedOut";
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
