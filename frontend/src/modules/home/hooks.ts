import {router} from "expo-router";
import {useCallback, useEffect, useState} from "react";

import {api, type User} from "@/services";

type State = { kind: "loading" } | { kind: "loaded"; user: User } | { kind: "error" };

// A dead session is ended by api.auth (the layout then sends the user to Login); any other failure shows here.
async function fetchState(): Promise<State> {
    try {
        return {kind: "loaded", user: await api.auth.me()};
    } catch {
        return {kind: "error"};
    }
}

// The profile button's letter (Spec §9, PM ruling 10): the trimmed name's first character upper-cased if it is a
// letter in any script, otherwise the email's initial.
export function profileInitial(fullName: string | null, email: string): string {
    const first = Array.from((fullName ?? "").trim())[0];
    if (first && /\p{L}/u.test(first)) {
        return first.toLocaleUpperCase();
    }
    return (Array.from(email.trim())[0] ?? "").toLocaleUpperCase();
}

// The saved name, loaded after the account (its email is the fallback). While it loads, or if it fails, the button
// shows the email's initial and still opens the Profile page.
function useProfileName(user: User | null): string | null {
    const [name, setName] = useState<string | null>(null);
    useEffect(() => {
        if (!user) {
            return;
        }
        let alive = true;
        api.profile.get()
            .then((profile) => alive && setName(profile.full_name))
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [user]);
    return name;
}

export function useHome() {
    const [state, setState] = useState<State>({kind: "loading"});
    const [leaving, setLeaving] = useState(false);
    const user = state.kind === "loaded" ? state.user : null;
    const name = useProfileName(user);

    useEffect(() => {
        let alive = true;
        fetchState().then((next) => alive && setState(next));
        return () => {
            alive = false;
        };
    }, []);

    const retry = useCallback(async () => {
        setState({kind: "loading"});
        setState(await fetchState());
    }, []);

    async function logout() {
        setLeaving(true);
        await api.auth.logout(); // clears stored tokens even if the call fails
        router.replace("/login");
    }

    return {
        state,
        retry,
        logout,
        leaving,
        initial: user ? profileInitial(name, user.email) : "",
        openProfile: () => router.push("/profile"),
    };
}
