// Request/response types come from the backend's OpenAPI (src/types/api.gen.ts, `npm run gen:api`).
// api.ts (live) and mock.ts both implement AuthApi, so a contract change breaks tsc in the mock too.
import type {components} from "@/types/api.gen";

type Schemas = components["schemas"];

export type SignupRequest = Schemas["SignupRequest"];
export type VerifyRequest = Schemas["VerifyRequest"];
export type EmailRequest = Schemas["EmailRequest"];
export type LoginRequest = Schemas["LoginRequest"];
export type RefreshRequest = Schemas["RefreshRequest"];
export type ResetCodeVerifyRequest = Schemas["ResetCodeVerifyRequest"];
export type ResetPasswordRequest = Schemas["ResetPasswordRequest"];
export type VerificationSentResponse = Schemas["VerificationSentResponse"];
export type ResendResponse = Schemas["ResendResponse"];
export type ResetCodeSentResponse = Schemas["ResetCodeSentResponse"];
export type ResetTokenResponse = Schemas["ResetTokenResponse"];
export type TokenPair = Schemas["TokenPair"];
export type User = Schemas["UserOut"];
export type ErrorBody = Schemas["ErrorResponse"];

// The transport: one method per §8 endpoint, no token handling (that is the session layer's job).
export interface AuthApi {
    signup(body: SignupRequest): Promise<VerificationSentResponse>;
    verify(body: VerifyRequest): Promise<TokenPair>;
    resend(body: EmailRequest): Promise<ResendResponse>;
    login(body: LoginRequest): Promise<TokenPair>;
    refresh(body: RefreshRequest): Promise<TokenPair>;
    logout(body: RefreshRequest): Promise<void>;
    me(accessToken: string): Promise<User>;
    forgotPassword(body: EmailRequest): Promise<ResetCodeSentResponse>;
    verifyResetCode(body: ResetCodeVerifyRequest): Promise<ResetTokenResponse>;
    resetPassword(body: ResetPasswordRequest): Promise<void>;
}
