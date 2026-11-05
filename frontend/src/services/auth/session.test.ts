import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {ApiError} from "@/services/api-error";
import {mockControl} from "@/services/mock/control";
import {memoryStorage} from "@/test/memory-storage";

import {users} from "./fixtures";
import {authMock} from "./mock";
import {createAuthClient} from "./session";

jest.mock("@/services/auth-storage", () => jest.requireActual<typeof import("@/test/memory-storage")>("@/test/memory-storage").memoryStorage);

beforeEach(async () => {
    mockControl.reset();
    mockControl.setLatency(0);
    await memoryStorage.clearTokens();
});

describe("auth session layer", () => {
    it("stores tokens on login and refreshes once on a 401", async () => {
        const client = createAuthClient(authMock);
        const statuses: string[] = [];
        client.subscribe((status) => statuses.push(status));
        await client.login({email: users.verified.email, password: users.verified.password});
        const before = memoryStorage.peek();

        const me = jest.spyOn(authMock, "me").mockRejectedValueOnce(new ApiError("invalid_token", 401, ""));
        expect((await client.me()).email).toBe(users.verified.email);
        expect(me).toHaveBeenCalledTimes(2);
        expect(memoryStorage.peek()?.refreshToken).not.toBe(before?.refreshToken);
        expect(statuses).toEqual(["signedIn"]);
        me.mockRestore();
    });

    it("ends the session when the refresh also fails", async () => {
        const client = createAuthClient(authMock);
        await client.login({email: users.verified.email, password: users.verified.password});
        mockControl.setScenario("auth.me", "invalid_token");
        mockControl.setScenario("auth.refresh", "invalid_refresh_token");
        await expect(client.me()).rejects.toMatchObject({code: "invalid_refresh_token"});
        expect(await client.sessionStatus()).toBe("signedOut");
    });

    it("logs out locally even when the server call fails", async () => {
        const client = createAuthClient(authMock);
        await client.login({email: users.verified.email, password: users.verified.password});
        mockControl.setScenario("auth.logout", "network_error");
        await client.logout();
        expect(memoryStorage.peek()).toBeNull();
    });
});
