import {router} from "expo-router";
import {useState} from "react";

import {friendlyError} from "@/hooks/use-error-text";
import {isValidEmail} from "@/hooks/use-validation";
import {api, errorCode} from "@/services";

import {ERROR_TEXT, TEXT} from "./constants";

export function useForgot() {
    const [email, setEmailValue] = useState("");
    const [touched, setTouched] = useState(false);
    const [serverEmailError, setServerEmailError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const emailOk = isValidEmail(email);
    const emailError = serverEmailError ?? (touched && !emailOk ? TEXT.invalidEmail : null);

    async function submit() {
        if (!emailOk || busy) {
            return;
        }
        setBusy(true);
        setError(null);
        const requestedAt = Date.now();
        try {
            await api.auth.forgotPassword({email: email.trim()});
            // Same outcome for every email (no enumeration): always on to Reset code.
            const params = {email: email.trim().toLowerCase(), sent: String(requestedAt)};
            router.push({pathname: "/forgot-code", params});
        } catch (caught) {
            if (errorCode(caught) === "invalid_email") {
                setServerEmailError(TEXT.invalidEmail);
            } else {
                setError(friendlyError(caught, ERROR_TEXT));
            }
        } finally {
            setBusy(false);
        }
    }

    return {
        email,
        setEmail: (value: string) => {
            setEmailValue(value);
            setServerEmailError(null);
        },
        blurEmail: () => setTouched(true),
        emailError,
        emailValid: emailOk && !emailError,
        error,
        busy,
        canSubmit: emailOk && !busy,
        submit,
        goLogin: () => router.replace("/login"),
    };
}
