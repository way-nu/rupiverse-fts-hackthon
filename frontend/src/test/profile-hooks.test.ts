import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {router} from "expo-router";

import {profileInitial} from "@/modules/home/hooks";
import {SAVE_ERROR_TEXT, SAVE_FAILED_TEXT, TEXT} from "@/modules/profile/constants";
import {fieldError, formatPhone, toUpdate, useProfile} from "@/modules/profile/hooks";
import {api} from "@/services";
import {users} from "@/services/auth/fixtures";
import {mockControl} from "@/services/mock/control";

jest.mock("@/services/auth-storage", () => jest.requireActual<typeof import("@/test/memory-storage")>("@/test/memory-storage").memoryStorage);
jest.mock("expo-router", () => ({
    router: {push: jest.fn(), replace: jest.fn()},
    useLocalSearchParams: () => ({}),
}));

beforeEach(async () => {
    jest.clearAllMocks();
    mockControl.reset();
    mockControl.setLatency(0);
    await api.auth.login({email: users.verified.email, password: users.verified.password});
});

async function loaded() {
    const hook = await renderHook(() => useProfile());
    await waitFor(() => expect(hook.result.current.load.kind).toBe("ready"));
    return hook.result;
}

describe("profileInitial (Home button letter, PM ruling 10)", () => {
    it.each([
        ["venu Gopal", "V"],
        ["  asha ", "A"],
        ["élodie", "É"],
        ["वेणु", "व"],
    ])("name %p → %p", (name, letter) => {
        expect(profileInitial(name, "demo@rupiverse.app")).toBe(letter);
    });

    it.each([null, "", "   ", "9 Lives", "#tag", "😀 Smiley"])("name %p falls back to the email's initial", (name) => {
        expect(profileInitial(name, "demo@rupiverse.app")).toBe("D");
    });
});

describe("profile field helpers", () => {
    const values = {name: "", age: "", gender: null, phone: ""};

    it("treats empty fields as valid", () => {
        expect(fieldError("name", values)).toBeNull();
        expect(fieldError("age", values)).toBeNull();
        expect(fieldError("phone", values)).toBeNull();
    });

    it("gives the design messages at the edges", () => {
        expect(fieldError("name", {...values, name: " ab "})).toBe(TEXT.nameShort);
        expect(fieldError("name", {...values, name: "abc"})).toBeNull();
        expect(fieldError("age", {...values, age: "17"})).toBe(TEXT.ageUnder);
        expect(fieldError("age", {...values, age: "18"})).toBeNull();
        expect(fieldError("age", {...values, age: "120"})).toBeNull();
        expect(fieldError("age", {...values, age: "121"})).toBe(TEXT.ageInvalid);
        expect(fieldError("phone", {...values, phone: "987654321"})).toBe(TEXT.phoneInvalid);
        expect(fieldError("phone", {...values, phone: "9876543210"})).toBeNull();
    });

    it("formats the phone for display only", () => {
        expect(formatPhone("98765")).toBe("98765");
        expect(formatPhone("9876543210")).toBe("98765 43210");
    });

    it("sends the four keys: trimmed name, number age, 10-digit phone, empties as null", () => {
        expect(toUpdate({name: "  Venu  ", age: "29", gender: "male", phone: "9876543210"}))
            .toEqual({full_name: "Venu", age: 29, gender: "male", phone: "9876543210"});
        expect(toUpdate({name: "  ", age: "", gender: null, phone: ""}))
            .toEqual({full_name: null, age: null, gender: null, phone: null});
    });
});

describe("useProfile (against services/profile/mock.ts)", () => {
    it("loads an empty profile with the account email", async () => {
        const result = await loaded();
        expect(result.current.load).toEqual({kind: "ready", email: users.verified.email});
        expect(result.current.name).toBe("");
        expect(result.current.canSave).toBe(true);
    });

    it("shows the error state on a load failure and recovers on retry", async () => {
        mockControl.setScenario("profile.get", "internal_error");
        const {result} = await renderHook(() => useProfile());
        await waitFor(() => expect(result.current.load.kind).toBe("error"));
        mockControl.setScenario("profile.get", "ok");
        await act(() => result.current.retry());
        expect(result.current.load.kind).toBe("ready");
    });

    it("validates on blur, not while typing, and disables Save", async () => {
        const result = await loaded();
        await act(() => result.current.setName("ab"));
        expect(result.current.errors.name).toBeNull();
        await act(() => result.current.blurName());
        expect(result.current.errors.name).toBe(TEXT.nameShort);
        expect(result.current.canSave).toBe(false);
    });

    it("keeps age and phone to digits within their caps", async () => {
        const result = await loaded();
        await act(() => {
            result.current.setAge("2a9-17");
            result.current.setPhone("+91 98765-43210 99");
        });
        expect(result.current.age).toBe("291");
        expect(result.current.phone).toBe("91987 65432");
    });

    it("clears the gender when the selected option is chosen again (component passes null)", async () => {
        const result = await loaded();
        await act(() => result.current.setGender("female"));
        expect(result.current.gender).toBe("female");
        await act(() => result.current.setGender(null));
        expect(result.current.gender).toBeNull();
    });

    it("saves, goes Home, and the next load returns the saved values", async () => {
        const result = await loaded();
        await act(() => {
            result.current.setName("Venu Gopal");
            result.current.setAge("29");
            result.current.setPhone("98765 43210");
            result.current.setGender("other");
        });
        await act(() => result.current.save());
        expect(router.replace).toHaveBeenCalledWith("/home");
        expect(await api.profile.get()).toMatchObject({
            full_name: "Venu Gopal", age: 29, gender: "other", phone: "9876543210",
        });
    });

    it("does not save while a field is invalid", async () => {
        const result = await loaded();
        await act(() => result.current.setPhone("123"));
        await act(() => result.current.save());
        expect(result.current.errors.phone).toBe(TEXT.phoneInvalid);
        expect(router.replace).not.toHaveBeenCalled();
    });

    it("maps invalid_profile to the friendly text and highlights the listed fields", async () => {
        const result = await loaded();
        await act(() => result.current.setName("Venu Gopal"));
        mockControl.setScenario("profile.update", "invalid_profile");
        await act(() => result.current.save());
        expect(result.current.saveError).toBe(SAVE_ERROR_TEXT.invalid_profile);
        expect(result.current.errors.name).not.toBeNull();
        expect(result.current.errors.phone).not.toBeNull();
        expect(result.current.errors.age).toBeNull();
        await act(() => result.current.setName("Venu G"));
        expect(result.current.errors.name).toBeNull();
    });

    it.each(["internal_error", "network_error", "invalid_request"])("maps %s to \"Couldn't save\" and keeps input", async (scenario) => {
        const result = await loaded();
        await act(() => result.current.setName("Venu Gopal"));
        mockControl.setScenario("profile.update", scenario);
        await act(() => result.current.save());
        expect(result.current.saveError).toBe(SAVE_FAILED_TEXT);
        expect(result.current.name).toBe("Venu Gopal");
        expect(result.current.saving).toBe(false);
    });
});
