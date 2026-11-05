import {useCallback, useEffect, useState} from "react";

// Counts down to a deadline (wall clock, so a backgrounded tab stays right). `startedAt` is when the window began
// (e.g. when the code was requested on the previous screen); `restart` starts a new window now.
export function useCountdown(initialSeconds: number, startedAt?: number) {
    const [deadline, setDeadline] = useState(() => (startedAt ?? Date.now()) + initialSeconds * 1000);
    const [now, setNow] = useState(() => Date.now());
    const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));

    useEffect(() => {
        if (remaining <= 0) {
            return;
        }
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [remaining, deadline]);

    const restart = useCallback((seconds: number = initialSeconds) => {
        const start = Date.now();
        setNow(start);
        setDeadline(start + seconds * 1000);
    }, [initialSeconds]);

    return {remaining, running: remaining > 0, restart};
}

export function formatCountdown(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
