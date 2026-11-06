// Live implementation of ProfileApi over http.ts.
import {request} from "@/services/http";

import type {ProfileApi} from "./types";

export const profileApi: ProfileApi = {
    get: (accessToken) => request("/profile", {method: "GET", accessToken}),
    update: (accessToken, body) => request("/profile", {method: "PUT", body, accessToken}),
};
