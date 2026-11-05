import {router, useLocalSearchParams} from "expo-router";

import {sentAtFrom, useCodeEntry} from "@/hooks/use-code-entry";
import {resetGrant} from "@/hooks/use-reset-grant";
import {api} from "@/services";

export function useForgotCode() {
    const params = useLocalSearchParams<{ email?: string; sent?: string }>();
    const email = (params.email ?? "").trim();
    const entry = useCodeEntry({
        sentAt: sentAtFrom(params.sent),
        submitCode: async (code) => {
            const {reset_token: token} = await api.auth.verifyResetCode({email, code});
            resetGrant.set({email, token});
            router.push("/reset");
        },
        // "Resend code" asks for a new reset code; the server always answers 202 (Spec §8).
        requestCode: async () => {
            await api.auth.forgotPassword({email});
        },
    });
    return {email, entry, back: () => router.replace("/forgot")};
}
