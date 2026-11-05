// Session status for the routing guards: read once from storage, then kept in sync by api.auth's events.
import {createContext, type ReactNode, useContext, useEffect, useState} from "react";

import {api, type SessionStatus} from "@/services";

export type SessionState = SessionStatus | "loading";

const SessionContext = createContext<SessionState>("loading");

export function SessionProvider({children}: { children: ReactNode }) {
    const [status, setStatus] = useState<SessionState>("loading");
    useEffect(() => {
        let alive = true;
        const unsubscribe = api.auth.subscribe((next) => setStatus(next));
        api.auth.sessionStatus().then((initial) => {
            if (alive) {
                setStatus((current) => (current === "loading" ? initial : current));
            }
        });
        return () => {
            alive = false;
            unsubscribe();
        };
    }, []);
    return <SessionContext.Provider value={status}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
    return useContext(SessionContext);
}
