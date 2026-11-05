import {router, useLocalSearchParams} from "expo-router";

import {sentAtFrom, useCodeEntry} from "@/hooks/use-code-entry";
import {api} from "@/services";

import {ERROR_TEXT} from "./constants";

export function useVerify() {
    const params = useLocalSearchParams<{ email?: string; sent?: string }>();
    const email = (params.email ?? "").trim();
    const entry = useCodeEntry({
        sentAt: sentAtFrom(params.sent),
        submitCode: async (code) => {
            await api.auth.verify({email, code});
            router.replace("/home");
        },
        requestCode: async () => {
            await api.auth.resend({email});
        },
        extraErrors: ERROR_TEXT,
    });
    return {
        email,
        entry,
        // Back and "Change email" both return to Signup with the email filled in (Spec §12).
        changeEmail: () => router.replace({pathname: "/signup", params: {email}}),
    };
}
