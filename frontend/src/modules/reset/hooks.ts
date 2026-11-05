import {router} from "expo-router";
import {useState} from "react";

import {friendlyError} from "@/hooks/use-error-text";
import {resetGrant} from "@/hooks/use-reset-grant";
import {isPasswordTooLong, isPasswordValid} from "@/hooks/use-validation";
import {api, errorCode} from "@/services";

import {RESET_DONE} from "@/modules/login/constants";

import {PASSWORD_ERRORS, TEXT} from "./constants";

export function useReset() {
    const [grant] = useState(() => resetGrant.get());
    const [password, setPasswordValue] = useState("");
    const [confirm, setConfirm] = useState("");
    const [touched, setTouched] = useState({password: false, confirm: false});
    const [serverPasswordError, setServerPasswordError] = useState<string | null>(null);
    const [error, setError] = useState<{ text: string; expired: boolean } | null>(null);
    const [busy, setBusy] = useState(false);

    const passwordOk = isPasswordValid(password);
    const matches = confirm === password;
    const passwordError = serverPasswordError ?? (isPasswordTooLong(password) ? TEXT.tooLong
        : touched.password && !passwordOk ? TEXT.weakPassword : null);
    const confirmError = touched.confirm && confirm.length > 0 && !matches ? TEXT.mismatch : null;

    async function submit() {
        if (!grant || !passwordOk || !matches || busy) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await api.auth.resetPassword({reset_token: grant.token, new_password: password});
            resetGrant.clear();
            router.replace({pathname: "/login", params: {reset: RESET_DONE}});
        } catch (caught) {
            const code = errorCode(caught);
            if (code === "invalid_reset_token") {
                resetGrant.clear();
                setError({text: TEXT.expired, expired: true});
            } else if (PASSWORD_ERRORS[code]) {
                setServerPasswordError(PASSWORD_ERRORS[code]);
            } else {
                setError({text: friendlyError(caught, {}), expired: false});
            }
        } finally {
            setBusy(false);
        }
    }

    return {
        hasGrant: grant !== null || error?.expired === true,
        password,
        setPassword: (value: string) => {
            setPasswordValue(value);
            setServerPasswordError(null);
        },
        confirm,
        setConfirm,
        blurPassword: () => setTouched((t) => ({...t, password: true})),
        blurConfirm: () => setTouched((t) => ({...t, confirm: true})),
        passwordError,
        confirmError,
        error,
        busy,
        canSubmit: grant !== null && passwordOk && matches && !busy,
        submit,
        restart: () => router.replace("/forgot"),
        back: () => router.replace(grant ? {pathname: "/forgot-code", params: {email: grant.email}} : "/forgot"),
    };
}
