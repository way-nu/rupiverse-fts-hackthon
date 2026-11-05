// Signed-in group: a signed-out user (or one whose session just ended) goes to Login.
import {Redirect, Slot} from "expo-router";

import {useSession} from "@/hooks/use-session";

export default function AppLayout() {
    const status = useSession();
    if (status === "loading") {
        return null;
    }
    if (status === "signedOut") {
        return <Redirect href="/login" />;
    }
    return <Slot />;
}
