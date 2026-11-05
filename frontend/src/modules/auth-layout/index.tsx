// Signed-out group: a signed-in user opening any auth route goes to Home.
import {Redirect, Slot} from "expo-router";

import {useSession} from "@/hooks/use-session";

export default function AuthLayout() {
    const status = useSession();
    if (status === "loading") {
        return null;
    }
    if (status === "signedIn") {
        return <Redirect href="/home" />;
    }
    return <Slot />;
}
