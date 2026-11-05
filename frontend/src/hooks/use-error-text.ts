import {errorCode, NETWORK_ERROR} from "@/services";

export const NETWORK_TEXT = "Can't reach Rupiverse. Check your connection and try again.";
export const FALLBACK_TEXT = "Something went wrong. Please try again.";

// Maps an error to the module's friendly text; raw server text is never shown (frontend/CLAUDE.md).
export function friendlyError(error: unknown, texts: Record<string, string>): string {
    const code = errorCode(error);
    return texts[code] ?? (code === NETWORK_ERROR ? NETWORK_TEXT : FALLBACK_TEXT);
}
