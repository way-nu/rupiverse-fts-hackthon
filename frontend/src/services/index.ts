// `api`: picked once from EXPO_PUBLIC_API_MODE (default live). The mock modules are only required in mock mode,
// and the condition is inlined at build time, so a live production bundle contains no mock code.
import {createAuthClient} from "./auth/session";
import type {AuthApi} from "./auth/types";
import type {ProfileApi, ProfileClient} from "./profile/types";

export {ApiError, errorCode, NETWORK_ERROR} from "./api-error";
export type {SessionStatus} from "./auth/session";
export type {User} from "./auth/types";
export type {Gender, ProfileOut, ProfileUpdate} from "./profile/types";

function authTransport(): AuthApi {
    if (process.env.EXPO_PUBLIC_API_MODE === "mock") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("./auth/mock").authMock;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./auth/api").authApi;
}

function profileTransport(): ProfileApi {
    if (process.env.EXPO_PUBLIC_API_MODE === "mock") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("./profile/mock").profileMock;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./profile/api").profileApi;
}

const auth = createAuthClient(authTransport());
const profileTransportImpl = profileTransport();

const profile: ProfileClient = {
    get: () => auth.authed((accessToken) => profileTransportImpl.get(accessToken)),
    update: (body) => auth.authed((accessToken) => profileTransportImpl.update(accessToken, body)),
};

export const api = {auth, profile};

export const API_MODE: "live" | "mock" = process.env.EXPO_PUBLIC_API_MODE === "mock" ? "mock" : "live";
