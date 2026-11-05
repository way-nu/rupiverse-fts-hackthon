import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {mockControl} from "@/services/mock/control";

import {MOCK_CODE, users} from "./fixtures";
import {authMock} from "./mock";

const code = (call: Promise<unknown>) => call.then(() => "ok", (error: { code: string }) => error.code);

beforeEach(() => {
    mockControl.reset();
    mockControl.setLatency(0);
});

describe("auth mock (stateful, Spec §8)", () => {
    it("signs up, locks after 3 wrong codes, unlocks on resend after 60 s", async () => {
        jest.useFakeTimers({doNotFake: ["setTimeout"]});
        await authMock.signup({email: "x@rupiverse.app", password: "Rupi@2026x"});
        await expect(authMock.verify({email: "x@rupiverse.app", code: "000000"}))
            .rejects.toMatchObject({code: "code_invalid", extras: {attempts_remaining: 2}});
        await expect(authMock.verify({email: "x@rupiverse.app", code: "000000"}))
            .rejects.toMatchObject({extras: {attempts_remaining: 1}});
        expect(await code(authMock.verify({email: "x@rupiverse.app", code: "000000"}))).toBe("code_locked");
        expect(await code(authMock.verify({email: "x@rupiverse.app", code: MOCK_CODE}))).toBe("code_locked");
        expect(await code(authMock.resend({email: "x@rupiverse.app"}))).toBe("resend_too_soon");

        jest.setSystemTime(Date.now() + 61_000);
        await authMock.resend({email: "x@rupiverse.app"});
        const pair = await authMock.verify({email: "x@rupiverse.app", code: MOCK_CODE});
        expect(pair.user.is_verified).toBe(true);
        jest.useRealTimers();
    });

    it("rejects a verified email at signup and an unverified login with 403 + email", async () => {
        expect(await code(authMock.signup({email: users.verified.email, password: "Rupi@2026x"}))).toBe("email_taken");
        await expect(authMock.login({email: users.unverified.email, password: users.unverified.password}))
            .rejects.toMatchObject({code: "email_not_verified", extras: {email: users.unverified.email}});
    });

    it("rotates refresh tokens and revokes on logout", async () => {
        const first = await authMock.login({email: users.verified.email, password: users.verified.password});
        const second = await authMock.refresh({refresh_token: first.refresh_token});
        expect(await code(authMock.refresh({refresh_token: first.refresh_token}))).toBe("invalid_refresh_token");
        await authMock.logout({refresh_token: second.refresh_token});
        expect(await code(authMock.me(second.access_token))).toBe("invalid_token");
    });

    it("resets the password once and ends every session", async () => {
        const session = await authMock.login({email: users.verified.email, password: users.verified.password});
        await authMock.forgotPassword({email: users.verified.email});
        const {reset_token: grant} = await authMock.verifyResetCode({email: users.verified.email, code: MOCK_CODE});
        expect(await code(authMock.resetPassword({reset_token: grant, new_password: "weak"}))).toBe("password_too_short");
        await authMock.resetPassword({reset_token: grant, new_password: "Verse#2027y"});
        expect(await code(authMock.resetPassword({reset_token: grant, new_password: "Verse#2027y"})))
            .toBe("invalid_reset_token");
        expect(await code(authMock.me(session.access_token))).toBe("invalid_token");
        expect(await code(authMock.login({email: users.verified.email, password: "Verse#2027y"}))).toBe("ok");
    });

    it("forces every scenario and rejects unknown ones", async () => {
        mockControl.setScenario("auth.login", "network_error");
        expect(await code(authMock.login({email: users.verified.email, password: users.verified.password})))
            .toBe("network_error");
        expect(() => mockControl.setScenario("auth.login", "nope")).toThrow();
        expect(() => mockControl.setScenario("auth.nope", "ok")).toThrow();
    });
});
