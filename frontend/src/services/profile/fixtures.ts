// Typed fixtures and named scenarios for GET/PUT /profile (RV4 Spec §8). Mock mode only.
import type {ErrorSpec} from "@/services/mock/control";

import type {ProfileUpdate} from "./types";

// Every error code §8 lists per endpoint (`ok` and `network_error` are added by mockControl).
const UNAUTHORISED = ["not_authenticated", "token_expired", "invalid_token"] as const;
export const scenarios = {
    get: [...UNAUTHORISED, "internal_error"],
    update: [...UNAUTHORISED, "internal_error", "invalid_profile", "invalid_request"],
} as const;

export const INVALID_PROFILE_DETAIL = "Some profile fields are not valid.";

export const errors: Record<string, ErrorSpec> = {
    not_authenticated: {status: 401, detail: "Sign in to continue."},
    token_expired: {status: 401, detail: "Your session has expired."},
    invalid_token: {status: 401, detail: "Your session is not valid."},
    internal_error: {status: 500, detail: "Something went wrong."},
    // The forced scenario highlights two fields; a real invalid save reports the fields that failed.
    invalid_profile: {status: 422, detail: INVALID_PROFILE_DETAIL, extras: {fields: ["full_name", "phone"]}},
    invalid_request: {status: 422, detail: "The request body is missing fields or has the wrong types.",
        extras: {fields: []}},
};

export const profiles: Record<"empty" | "filled", ProfileUpdate> = {
    empty: {full_name: null, age: null, gender: null, phone: null},
    filled: {full_name: "Venu Gopal", age: 29, gender: "male", phone: "9876543210"},
};
