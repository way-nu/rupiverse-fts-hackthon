// The only place that calls fetch. Base URL from EXPO_PUBLIC_API_URL; every failure becomes an ApiError.
import {ApiError, type ApiErrorExtras, NETWORK_ERROR} from "./api-error";

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

type RequestOptions = {
    method?: "GET" | "POST";
    body?: unknown;
    accessToken?: string;
};

export async function request<T>(path: string, {method = "POST", body, accessToken}: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {Accept: "application/json"};
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    let response: Response;
    try {
        response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError(NETWORK_ERROR, 0, "Network request failed");
    }

    if (response.status === 204) {
        return undefined as T;
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const data = (payload ?? {}) as { error?: string; detail?: string } & ApiErrorExtras;
        const {error, detail, ...extras} = data;
        throw new ApiError(error ?? "server_error", response.status, typeof detail === "string" ? detail : "", extras);
    }
    return payload as T;
}
