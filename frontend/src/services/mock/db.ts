// The mock engine's store: named tables kept in memory and, on web, persisted to localStorage so mock state survives a
// reload. `resetAll()` puts every table back to its seed.
const PREFIX = "rupiverse.mock.db.";

type Table<T> = {
    get(): T;
    set(next: T): void;
    update(change: (draft: T) => void): T;
    reset(): void;
};

const tables = new Map<string, Table<unknown>>();

function storage(): Storage | null {
    try {
        return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
    } catch {
        return null;
    }
}

// `persist: false` keeps a table in memory only (e.g. secrets that must never be written to disk).
export function table<T>(name: string, seed: () => T, {persist = true}: { persist?: boolean } = {}): Table<T> {
    const existing = tables.get(name);
    if (existing) {
        return existing as Table<T>;
    }
    const key = PREFIX + name;
    const load = (): T => {
        const raw = persist ? storage()?.getItem(key) : null;
        if (raw) {
            try {
                return JSON.parse(raw) as T;
            } catch {
                // fall through to the seed
            }
        }
        return seed();
    };
    let value = load();
    const save = () => {
        if (persist) {
            storage()?.setItem(key, JSON.stringify(value));
        }
    };
    const created: Table<T> = {
        get: () => value,
        set(next) {
            value = next;
            save();
        },
        update(change) {
            change(value);
            save();
            return value;
        },
        reset() {
            storage()?.removeItem(key);
            value = seed();
            save();
        },
    };
    tables.set(name, created as Table<unknown>);
    return created;
}

export const mockDb = {
    table,
    resetAll(): void {
        tables.forEach((t) => t.reset());
    },
};
