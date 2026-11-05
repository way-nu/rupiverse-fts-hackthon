// Token storage on native: expo-secure-store. The web variant (auth-storage.web.ts) uses localStorage.
import * as SecureStore from "expo-secure-store";

import type {StoredTokens} from "./auth-storage.types";

const KEY = "rupiverse.session";

export async function readTokens(): Promise<StoredTokens | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

export async function writeTokens(tokens: StoredTokens): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY);
}

export type {StoredTokens};
