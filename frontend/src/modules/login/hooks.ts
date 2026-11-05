import {router, useLocalSearchParams} from "expo-router";
import {useState} from "react";

import {friendlyError} from "@/hooks/use-error-text";
import {api, ApiError} from "@/services";

import {ERROR_TEXT, RESET_DONE} from "./constants";

export function useLogin() {
    const params = useLocalSearchParams<{ reset?: string; email?: string }>();
    const [email, setEmail] = useState(params.email ?? "");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

    async function submit() {
        if (!canSubmit) {
            return;
        }
        setBusy(true);
        setError(null);
        const requestedAt = Date.now();
        try {
            await api.auth.login({email: email.trim(), password});
            router.replace("/home");
        } catch (caught) {
            if (caught instanceof ApiError && caught.code === "email_not_verified") {
                const unverified = caught.extras.email ?? email.trim().toLowerCase();
                router.push({pathname: "/verify", params: {email: unverified, sent: String(requestedAt)}});
                return;
            }
            setError(friendlyError(caught, ERROR_TEXT));
        } finally {
            setBusy(false);
        }
    }

    return {
        email,
        setEmail,
        password,
        setPassword,
        error,
        busy,
        canSubmit,
        submit,
        showResetBanner: params.reset === RESET_DONE,
        goForgot: () => router.push("/forgot"),
        goSignup: () => router.push("/signup"),
    };
}
