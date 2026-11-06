// Request/response types come from the backend's OpenAPI (src/types/api.gen.ts, `npm run gen:api`).
// api.ts (live) and mock.ts both implement ProfileApi, so a contract change breaks tsc in the mock too.
import type {components} from "@/types/api.gen";

type Schemas = components["schemas"];

export type ProfileUpdate = Schemas["ProfileUpdate"];
export type ProfileOut = Schemas["ProfileOut"];
export type Gender = NonNullable<ProfileOut["gender"]>;

// The transport: one method per §8 endpoint. Token handling (refresh once, then sign out) is the session layer's job.
export interface ProfileApi {
    get(accessToken: string): Promise<ProfileOut>;
    update(accessToken: string, body: ProfileUpdate): Promise<ProfileOut>;
}

// What hooks call as `api.profile`.
export type ProfileClient = {
    get(): Promise<ProfileOut>;
    update(body: ProfileUpdate): Promise<ProfileOut>;
};
