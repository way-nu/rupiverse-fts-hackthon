// In-memory stand-in for services/auth-storage in unit tests (jest.mock("@/services/auth-storage", ...)).
import type {StoredTokens} from "@/services/auth-storage.types";

let tokens: StoredTokens | null = null;

export const memoryStorage = {
    readTokens: async () => tokens,
    writeTokens: async (next: StoredTokens) => {
        tokens = next;
    },
    clearTokens: async () => {
        tokens = null;
    },
    peek: () => tokens,
};
