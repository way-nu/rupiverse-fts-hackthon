// Mock implementation of ProfileApi: behaves like the backend (RV4 Spec §8) over the mock db. Mock mode only.
import {ageProblem, isValidName, isValidPhone, type ProfileField} from "@/hooks/use-validation";
import {ApiError} from "@/services/api-error";
import {mockUserForToken} from "@/services/auth/mock";
import {mockControl, registerScenarios} from "@/services/mock/control";
import {table} from "@/services/mock/db";

import {errors, INVALID_PROFILE_DETAIL, scenarios} from "./fixtures";
import type {Gender, ProfileApi, ProfileOut, ProfileUpdate} from "./types";

type Stored = Omit<ProfileOut, "email">;

const KEYS: ProfileField[] = ["full_name", "age", "gender", "phone"];
const GENDERS: readonly string[] = ["male", "female", "other"];

registerScenarios("profile", scenarios, errors);

// One saved profile per user id; a user who never saved has no entry.
const state = table<Record<string, Stored>>("profile", () => ({}));

async function gate(method: keyof typeof scenarios): Promise<void> {
    await mockControl.delay();
    const key = `profile.${method}`;
    const forced = mockControl.scenario(key);
    if (forced !== "ok") {
        throw mockControl.errorFor(key, forced);
    }
}

function caller(accessToken: string): { id: string; email: string } {
    const user = mockUserForToken(accessToken);
    if (!user) {
        throw new ApiError("invalid_token", errors.invalid_token.status, errors.invalid_token.detail);
    }
    return user;
}

const blank = (value: unknown) => value === null || value === "";

// §8 types: exactly the four keys; name/gender/phone string or null; age JSON integer, "" or null.
function typeProblems(body: unknown): string[] | null {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return [];
    }
    const record = body as Record<string, unknown>;
    const bad = new Set(Object.keys(record).filter((key) => !KEYS.includes(key as ProfileField)));
    for (const key of KEYS) {
        const value = record[key];
        const ok = key in record && (value === null || (key === "age"
            ? value === "" || Number.isInteger(value)
            : typeof value === "string"));
        if (!ok) {
            bad.add(key);
        }
    }
    return bad.size ? [...bad].sort() : null;
}

function normalise(body: ProfileUpdate): Stored & { invalid: ProfileField[] } {
    const name = typeof body.full_name === "string" ? body.full_name.trim() : null;
    const invalid: ProfileField[] = [];
    if (name && !isValidName(name)) invalid.push("full_name");
    if (!blank(body.age) && ageProblem(String(body.age))) invalid.push("age");
    if (!blank(body.gender) && !GENDERS.includes(body.gender as string)) invalid.push("gender");
    if (!blank(body.phone) && !isValidPhone(body.phone as string)) invalid.push("phone");
    return {
        full_name: name || null,
        age: blank(body.age) ? null : Number(body.age),
        gender: blank(body.gender) ? null : (body.gender as Gender),
        phone: blank(body.phone) ? null : body.phone,
        updated_at: new Date().toISOString(),
        invalid,
    };
}

export const profileMock: ProfileApi = {
    async get(accessToken) {
        await gate("get");
        const user = caller(accessToken);
        const saved = state.get()[user.id];
        return {
            email: user.email,
            full_name: saved?.full_name ?? null,
            age: saved?.age ?? null,
            gender: saved?.gender ?? null,
            phone: saved?.phone ?? null,
            updated_at: saved?.updated_at ?? null,
        };
    },

    async update(accessToken, body) {
        await gate("update");
        const user = caller(accessToken);
        const wrongTypes = typeProblems(body);
        if (wrongTypes) {
            throw mockControl.errorFor("profile.update", "invalid_request", {fields: wrongTypes});
        }
        const {invalid, ...next} = normalise(body);
        if (invalid.length) {
            throw new ApiError("invalid_profile", 422, INVALID_PROFILE_DETAIL, {fields: invalid});
        }
        state.update((all) => {
            all[user.id] = next;
        });
        return {email: user.email, ...next};
    },
};
