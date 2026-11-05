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

export function useHome() {
    const [state, setState] = useState<State>({kind: "loading"});
    const [leaving, setLeaving] = useState(false);

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

    return {state, retry, logout, leaving};
}
