import {router, useLocalSearchParams} from "expo-router";
import {useState} from "react";

import {friendlyError} from "@/hooks/use-error-text";
import {isPasswordTooLong, isPasswordValid, isValidEmail} from "@/hooks/use-validation";
import {api, errorCode} from "@/services";

import {EMAIL_ERRORS, ERROR_TEXT, PASSWORD_ERRORS, TEXT} from "./constants";

export function useSignup() {
    const params = useLocalSearchParams<{ email?: string }>();
    const [email, setEmailValue] = useState(params.email ?? "");
    const [password, setPasswordValue] = useState("");
    const [touched, setTouched] = useState({email: false, password: false});
    const [serverEmailError, setServerEmailError] = useState<string | null>(null);
    const [serverPasswordError, setServerPasswordError] = useState<string | null>(null);
    const [error, setError] = useState<{ text: string; emailTaken: boolean } | null>(null);
    const [busy, setBusy] = useState(false);

    const emailOk = isValidEmail(email);
    const passwordOk = isPasswordValid(password);
    const emailError = serverEmailError ?? (touched.email && !emailOk ? TEXT.invalidEmail : null);
    const passwordError = serverPasswordError ?? (isPasswordTooLong(password) ? TEXT.tooLong
        : touched.password && !passwordOk ? TEXT.weakPassword : null);

    async function submit() {
        if (!emailOk || !passwordOk || busy) {
            return;
        }
        setBusy(true);
        setError(null);
        const requestedAt = Date.now();
        try {
            const sent = await api.auth.signup({email: email.trim(), password});
            router.push({pathname: "/verify", params: {email: sent.email, sent: String(requestedAt)}});
        } catch (caught) {
            const code = errorCode(caught);
            if (EMAIL_ERRORS[code]) {
                setServerEmailError(EMAIL_ERRORS[code]);
            } else if (PASSWORD_ERRORS[code]) {
                setServerPasswordError(PASSWORD_ERRORS[code]);
            } else {
                setError({text: friendlyError(caught, ERROR_TEXT), emailTaken: code === "email_taken"});
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
        password,
        setPassword: (value: string) => {
            setPasswordValue(value);
            setServerPasswordError(null);
        },
        blurEmail: () => setTouched((t) => ({...t, email: true})),
        blurPassword: () => setTouched((t) => ({...t, password: true})),
        emailError,
        emailValid: emailOk && !emailError,
        passwordError,
        error,
        busy,
        canSubmit: emailOk && passwordOk && !busy,
        submit,
        goLogin: () => router.push("/login"),
    };
}
