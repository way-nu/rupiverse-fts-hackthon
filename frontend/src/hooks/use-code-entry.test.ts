import {describe, expect, it, jest} from "@jest/globals";
import {act, renderHook} from "@testing-library/react-native";

import {ApiError} from "@/services/api-error";

import {CODE_TEXT, useCodeEntry} from "./use-code-entry";

type CodeCall = () => Promise<void>;

function setup(submitCode: CodeCall, requestCode: CodeCall = jest.fn<CodeCall>().mockResolvedValue(undefined)) {
    return renderHook(() => useCodeEntry({submitCode, requestCode, sentAt: Date.now() - 61_000}));
}

describe("useCodeEntry", () => {
    it("maps code errors to friendly text and locks on code_locked", async () => {
        const submit = jest.fn<CodeCall>()
            .mockRejectedValueOnce(new ApiError("code_invalid", 400, "", {attempts_remaining: 1}))
            .mockRejectedValueOnce(new ApiError("code_locked", 400, ""));
        const {result} = await setup(submit);
        await act(() => result.current.setCode("000000"));
        await act(() => result.current.submit());
        expect(result.current.error).toBe(CODE_TEXT.invalid(1));
        await act(() => result.current.submit());
        expect(result.current.error).toBe(CODE_TEXT.locked);
        expect(result.current.locked).toBe(true);
        expect(result.current.canSubmit).toBe(false);
    });

    it("resend clears the code, the error and the lock, and restarts the countdown", async () => {
        const submit = jest.fn<CodeCall>().mockRejectedValue(new ApiError("code_locked", 400, ""));
        const {result} = await setup(submit);
        await act(() => result.current.setCode("000000"));
        await act(() => result.current.submit());
        expect(result.current.countdown.running).toBe(false);
        await act(() => result.current.resend());
        expect(result.current).toMatchObject({code: "", error: null, locked: false});
        expect(result.current.countdown.remaining).toBe(60);
    });

    it("resend_too_soon shows the wait and counts it down", async () => {
        const request = jest.fn<CodeCall>().mockRejectedValue(new ApiError("resend_too_soon", 429, "", {retry_after_seconds: 12}));
        const {result} = await setup(jest.fn<CodeCall>(), request);
        await act(() => result.current.resend());
        expect(result.current.error).toBe(CODE_TEXT.tooSoon(12));
        expect(result.current.countdown.remaining).toBe(12);
    });
});
