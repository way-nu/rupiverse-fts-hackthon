// Scenario + latency switches for the mocks, exposed as window.__mock on web:
//   __mock.setScenario("auth.login", "invalid_credentials"), __mock.setLatency(ms), __mock.reset()
// Settings persist (localStorage on web) so a forced scenario survives navigation and reloads.
import {ApiError, type ApiErrorExtras, NETWORK_ERROR} from "@/services/api-error";

import {mockDb, table} from "./db";

export const DEFAULT_LATENCY_MS = 300;
export const OK = "ok";

export type ErrorSpec = { status: number; detail: string; extras?: ApiErrorExtras };

type Registry = Map<string, { scenarios: Set<string>; errors: Record<string, ErrorSpec> }>;

const registry: Registry = new Map();
const settings = table("control", () => ({latency: DEFAULT_LATENCY_MS, scenarios: {} as Record<string, string>}));

// Each mock module registers its methods: the error codes it can be forced into, and how each error looks.
export function registerScenarios(module: string, methods: Record<string, readonly string[]>,
    errors: Record<string, ErrorSpec>): void {
    for (const [method, codes] of Object.entries(methods)) {
        registry.set(`${module}.${method}`, {scenarios: new Set([OK, ...codes, NETWORK_ERROR]), errors});
    }
}

function setScenario(key: string, scenario: string): void {
    const entry = registry.get(key);
    if (!entry) {
        throw new Error(`Unknown mock method "${key}". Known: ${[...registry.keys()].join(", ")}`);
    }
    if (!entry.scenarios.has(scenario)) {
        throw new Error(`Unknown scenario "${scenario}" for ${key}. Known: ${[...entry.scenarios].join(", ")}`);
    }
    settings.update((s) => {
        s.scenarios[key] = scenario;
    });
}

function setLatency(ms: number): void {
    settings.update((s) => {
        s.latency = Math.max(0, Number(ms) || 0);
    });
}

function reset(): void {
    mockDb.resetAll();
}

export const mockControl = {
    setScenario,
    setLatency,
    reset,
    scenario(key: string): string {
        return settings.get().scenarios[key] ?? OK;
    },
    delay(): Promise<void> {
        const ms = settings.get().latency;
        return new Promise((resolve) => setTimeout(resolve, ms));
    },
    errorFor(key: string, scenario: string, extras: ApiErrorExtras = {}): ApiError {
        if (scenario === NETWORK_ERROR) {
            return new ApiError(NETWORK_ERROR, 0, "Network request failed");
        }
        const spec = registry.get(key)?.errors[scenario];
        if (!spec) {
            return new ApiError(scenario, 500, scenario);
        }
        return new ApiError(scenario, spec.status, spec.detail, {...spec.extras, ...extras});
    },
};

if (typeof window !== "undefined") {
    (window as unknown as { __mock: unknown }).__mock = {setScenario, setLatency, reset};
}
