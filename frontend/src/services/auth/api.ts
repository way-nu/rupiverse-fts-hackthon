// Live implementation of AuthApi over http.ts.
import {request} from "@/services/http";

import type {AuthApi} from "./types";

export const authApi: AuthApi = {
    signup: (body) => request("/auth/signup", {body}),
    verify: (body) => request("/auth/verify", {body}),
    resend: (body) => request("/auth/resend", {body}),
    login: (body) => request("/auth/login", {body}),
    refresh: (body) => request("/auth/refresh", {body}),
    logout: (body) => request("/auth/logout", {body}),
    me: (accessToken) => request("/me", {method: "GET", accessToken}),
    forgotPassword: (body) => request("/auth/password/forgot", {body}),
    verifyResetCode: (body) => request("/auth/password/verify-code", {body}),
    resetPassword: (body) => request("/auth/password/reset", {body}),
};
