// `api`: picked once from EXPO_PUBLIC_API_MODE (default live). The mock modules are only required in mock mode,
// and the condition is inlined at build time, so a live production bundle contains no mock code.
import {createAuthClient} from "./auth/session";
import type {AuthApi} from "./auth/types";

export {ApiError, errorCode, NETWORK_ERROR} from "./api-error";
export type {SessionStatus} from "./auth/session";
export type {User} from "./auth/types";

function authTransport(): AuthApi {
    if (process.env.EXPO_PUBLIC_API_MODE === "mock") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("./auth/mock").authMock;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./auth/api").authApi;
}

export const api = {
    auth: createAuthClient(authTransport()),
};

export const API_MODE: "live" | "mock" = process.env.EXPO_PUBLIC_API_MODE === "mock" ? "mock" : "live";
