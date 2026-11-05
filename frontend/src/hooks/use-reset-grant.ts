// The single-use reset grant from "verify reset code", held in memory only (never persisted, Spec §9):
// a reload of New password loses it and the user starts again at Forgot.
type Grant = { email: string; token: string };

let grant: Grant | null = null;

export const resetGrant = {
    get: (): Grant | null => grant,
    set: (next: Grant) => {
        grant = next;
    },
    clear: () => {
        grant = null;
    },
};
