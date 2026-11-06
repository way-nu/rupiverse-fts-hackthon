import {beforeEach, describe, expect, it} from "@jest/globals";

import {ApiError} from "@/services/api-error";
import {authMock} from "@/services/auth/mock";
import {users} from "@/services/auth/fixtures";
import {mockControl} from "@/services/mock/control";

import {profileMock} from "./mock";
import type {ProfileUpdate} from "./types";

let token = "";

beforeEach(async () => {
    mockControl.reset();
    mockControl.setLatency(0);
    token = (await authMock.login({email: users.verified.email, password: users.verified.password})).access_token;
});

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
    try {
        await promise;
    } catch (error) {
        return error as ApiError;
    }
    throw new Error("expected a rejection");
}

describe("profileMock (RV4 Spec §8)", () => {
    it("returns an empty profile with the email before the first save", async () => {
        expect(await profileMock.get(token)).toEqual({
            email: users.verified.email, full_name: null, age: null, gender: null, phone: null, updated_at: null,
        });
    });

    it("saves, trims the name, turns empty strings into null, and sets updated_at", async () => {
        const saved = await profileMock.update(token, {full_name: "  Venu  ", age: "", gender: "", phone: "9876543210"});
        expect(saved).toMatchObject({full_name: "Venu", age: null, gender: null, phone: "9876543210"});
        expect(saved.updated_at).not.toBeNull();
        expect(await profileMock.get(token)).toEqual(saved);
    });

    it("reports every invalid field in §8 order and saves nothing", async () => {
        const error = await rejection(profileMock.update(token,
            {full_name: "ab", age: 17, gender: "Male", phone: "+919876543"}));
        expect(error.code).toBe("invalid_profile");
        expect(error.extras.fields).toEqual(["full_name", "age", "gender", "phone"]);
        expect((await profileMock.get(token)).updated_at).toBeNull();
    });

    it("rejects wrong types and unknown keys with invalid_request", async () => {
        const body = {full_name: null, age: "29", gender: null, phone: null, user_id: "x"} as unknown as ProfileUpdate;
        const error = await rejection(profileMock.update(token, body));
        expect(error.code).toBe("invalid_request");
        expect(error.extras.fields).toEqual(["age", "user_id"]);
    });

    it("rejects an unknown token with invalid_token", async () => {
        expect((await rejection(profileMock.get("nope"))).code).toBe("invalid_token");
    });

    it("can be forced into every listed scenario", async () => {
        mockControl.setScenario("profile.update", "invalid_profile");
        const empty = {full_name: null, age: null, gender: null, phone: null};
        const error = await rejection(profileMock.update(token, empty));
        expect(error.extras.fields).toEqual(["full_name", "phone"]);
    });
});
