// Token storage on web: localStorage (moving the refresh token to an httpOnly cookie is RV3).
import type {StoredTokens} from "./auth-storage.types";

const KEY = "rupiverse.session";

export async function readTokens(): Promise<StoredTokens | null> {
    try {
        const raw = window.localStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as StoredTokens) : null;
    } catch {
        return null;
    }
}

export async function writeTokens(tokens: StoredTokens): Promise<void> {
    window.localStorage.setItem(KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
    window.localStorage.removeItem(KEY);
}

export type {StoredTokens};
