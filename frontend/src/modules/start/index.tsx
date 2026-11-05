// "/": Home with a session, otherwise Login.
import {Redirect} from "expo-router";

import {useSession} from "@/hooks/use-session";

export default function Start() {
    const status = useSession();
    if (status === "loading") {
        return null;
    }
    return <Redirect href={status === "signedIn" ? "/home" : "/login"} />;
}
