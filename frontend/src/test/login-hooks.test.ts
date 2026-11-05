import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {act, renderHook} from "@testing-library/react-native";
import {router} from "expo-router";

import {mockControl} from "@/services/mock/control";

import {ERROR_TEXT} from "@/modules/login/constants";
import {useLogin} from "@/modules/login/hooks";

jest.mock("@/services/auth-storage", () => jest.requireActual<typeof import("@/test/memory-storage")>("@/test/memory-storage").memoryStorage);
jest.mock("expo-router", () => ({
    router: {push: jest.fn(), replace: jest.fn()},
    useLocalSearchParams: () => ({}),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockControl.reset();
    mockControl.setLatency(0);
});

async function submitWith(email: string, password: string) {
    const {result} = await renderHook(() => useLogin());
    await act(() => {
        result.current.setEmail(email);
        result.current.setPassword(password);
    });
    await act(() => result.current.submit());
    return result;
}

describe("useLogin (against services/auth/mock.ts)", () => {
    it("goes Home on success", async () => {
        await submitWith("demo@rupiverse.app", "Demo@1234");
        expect(router.replace).toHaveBeenCalledWith("/home");
    });

    it("shows friendly text for invalid_credentials", async () => {
        const result = await submitWith("demo@rupiverse.app", "Wrong@Pass1");
        expect(result.current.error).toBe(ERROR_TEXT.invalid_credentials);
    });

    it("sends an unverified user to Verify with the email", async () => {
        await submitWith("new@rupiverse.app", "Demo@1234");
        expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
            pathname: "/verify",
            params: expect.objectContaining({email: "new@rupiverse.app"}),
        }));
    });

    it("keeps the email and shows the network text on network_error", async () => {
        mockControl.setScenario("auth.login", "network_error");
        const result = await submitWith("demo@rupiverse.app", "Demo@1234");
        expect(result.current.error).toMatch(/connection/);
        expect(result.current.email).toBe("demo@rupiverse.app");
    });
});
