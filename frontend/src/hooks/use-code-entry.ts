// Shared logic for the two code screens (Verify email, Reset code): 6-digit entry, 60 s resend countdown,
// attempt counting to the lock (Spec §8), and mapping each code error to its friendly text.
import {useState} from "react";

import {useCountdown} from "@/hooks/use-countdown";
import {friendlyError} from "@/hooks/use-error-text";
import {ApiError, errorCode} from "@/services";

export const RESEND_SECONDS = 60;

export const CODE_TEXT = {
    invalid: (left: number) => `Wrong code — ${left} ${left === 1 ? "attempt" : "attempts"} left`,
    locked: "Too many attempts — resend a new code",
    expired: "Code expired — resend",
    tooSoon: (seconds: number) => `Please wait ${seconds}s before asking for a new code.`,
    sendFailed: "We couldn't send a new code. Please try again in a moment.",
};

type Options = {
    submitCode: (code: string) => Promise<void>;
    requestCode: () => Promise<void>;
    extraErrors?: Record<string, string>;
    // When the current code was requested (ms since epoch), so the 60 s countdown starts from the request.
    sentAt?: number;
};

// Reads the `sent` route param written by the screen that requested the code.
export function sentAtFrom(param: string | undefined): number | undefined {
    const value = Number(param);
    return Number.isFinite(value) && value > 0 && value <= Date.now() ? value : undefined;
}

export function useCodeEntry({submitCode, requestCode, extraErrors = {}, sentAt}: Options) {
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [locked, setLocked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [resending, setResending] = useState(false);
    const countdown = useCountdown(RESEND_SECONDS, sentAt);

    async function submit() {
        if (code.length !== 6 || locked || busy) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await submitCode(code);
        } catch (caught) {
            const failed = errorCode(caught);
            if (failed === "code_invalid") {
                const left = caught instanceof ApiError ? caught.extras.attempts_remaining ?? 2 : 2;
                setError(CODE_TEXT.invalid(left));
            } else if (failed === "code_locked") {
                setError(CODE_TEXT.locked);
                setLocked(true);
            } else if (failed === "code_expired") {
                setError(CODE_TEXT.expired);
            } else {
                setError(friendlyError(caught, extraErrors));
            }
        } finally {
            setBusy(false);
        }
    }

    async function resend() {
        if (countdown.running || resending) {
            return;
        }
        setResending(true);
        try {
            await requestCode();
            countdown.restart(RESEND_SECONDS);
            setCode("");
            setError(null);
            setLocked(false);
        } catch (caught) {
            if (errorCode(caught) === "resend_too_soon" && caught instanceof ApiError) {
                const wait = caught.extras.retry_after_seconds ?? RESEND_SECONDS;
                setError(CODE_TEXT.tooSoon(wait));
                countdown.restart(wait);
            } else {
                setError(friendlyError(caught, {email_send_failed: CODE_TEXT.sendFailed, ...extraErrors}));
            }
        } finally {
            setResending(false);
        }
    }

    return {
        code,
        setCode,
        error,
        locked,
        busy,
        canSubmit: code.length === 6 && !locked && !busy,
        submit,
        resend,
        countdown,
    };
}
