// The one error type the app sees, thrown by the live API and by the mocks alike (Spec §8 error codes).

export type ApiErrorExtras = {
    attempts_remaining?: number;
    retry_after_seconds?: number;
    email?: string;
    fields?: string[];
};

export const NETWORK_ERROR = "network_error";

export class ApiError extends Error {
    readonly code: string;
    readonly status: number;
    readonly detail: string;
    readonly extras: ApiErrorExtras;

    constructor(code: string, status: number, detail: string, extras: ApiErrorExtras = {}) {
        super(code);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
        this.detail = detail;
        this.extras = extras;
    }
}

export function errorCode(error: unknown): string {
    return error instanceof ApiError ? error.code : NETWORK_ERROR;
}
