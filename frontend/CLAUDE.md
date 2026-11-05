@AGENTS.md

# RupiVerse frontend — rules for agents

Expo (React Native) + Expo Router · TypeScript strict · runs on iOS, Android and web. Web (Expo web) is what tests
and demos use, so every screen must work there.

## Commands

- Install: `npm install` (Expo-compatible versions: `npx expo install <pkg>`)
- Run web against the real backend: `npx expo start --web --port $PORT`
- Run web fully mocked (no backend needed): `EXPO_PUBLIC_API_MODE=mock npx expo start --web --port $PORT`
- Regenerate API types from the backend: `npm run gen:api` (reads `$EXPO_PUBLIC_API_URL/openapi.json`)
- Lint: `npx expo lint` · Types: `npx tsc --noEmit`
- Unit tests: `npm test`
- E2E: `npx playwright test --project=mock` (UI states) · `npx playwright test --project=live` (full stack)

## Code structure

Every file in `src/app/` is a route (Expo Router), so `src/app/` holds **only** thin route files and `_layout.tsx`
files. All real code lives outside it, grouped by module:

```
src/
├── app/                      # routing only; route files just re-export the screen
│   ├── _layout.tsx
│   ├── (auth)/               # signed-out group: login, signup, verify
│   │   └── login.tsx         # export {default} from '@/modules/login';
│   └── (app)/                # signed-in group
│       └── index.tsx         # export {default} from '@/modules/home';
├── modules/                  # one folder per module (screen/feature), named after the module
│   └── login/
│       ├── index.tsx         # the screen component: UI only
│       ├── hooks.ts          # all logic and state (e.g. useLogin)
│       ├── constants.ts      # constants for this screen
│       ├── styles.ts         # StyleSheet.create(...) for this screen
│       └── components/       # components used only by this screen
│           └── password-checklist/   # same four files again, nested as deep as needed
│               ├── index.tsx
│               ├── hooks.ts
│               ├── constants.ts
│               └── styles.ts
├── components/               # shared, reusable components (same folder-per-component convention)
├── hooks/                    # shared hooks
├── constants/                # global constants (theme, spacing, ...)
├── services/                 # all network and data access; screens never fetch directly
│   ├── index.ts              # exports `api`: live or mock, picked once from EXPO_PUBLIC_API_MODE
│   ├── http.ts               # fetch wrapper: base URL, auth header, refresh, throws ApiError
│   ├── api-error.ts          # ApiError(code, status, detail), thrown by live AND mock
│   ├── auth-storage.ts       # token storage (secure-store); auth-storage.web.ts for localStorage
│   ├── mock/                 # mock engine, shared by every module
│   │   ├── db.ts             # in-memory store (persisted to localStorage on web), reset()
│   │   └── control.ts        # scenario + latency switches; exposed as window.__mock on web
│   └── auth/                 # one folder per backend module, same files each time
│       ├── types.ts          # request/response types, re-exported from src/types/api.gen.ts
│       ├── api.ts            # live implementation of AuthApi (calls http.ts)
│       ├── mock.ts           # mock implementation of AuthApi (uses mock/db + fixtures)
│       └── fixtures.ts       # typed fixture objects + named scenarios per endpoint
└── types/                    # shared types; api.gen.ts is generated, never edit it
design/
└── *.jsx, Rupiverse.html     # JSX export of the Claude Design project. Read-only, not imported; replaced whole.
e2e/                          # Playwright specs, rv<n>-*.spec.ts
```

- Each component gets its own kebab-case folder with `index.tsx`; it must not hold logic. Logic goes in `hooks.ts`,
constants in `constants.ts`, and styles in `styles.ts`. Create only the files a component actually needs.
- A component broken into smaller pieces gets those pieces in a `components/` folder inside its own folder, following
the same convention recursively.
- Platform variants sit beside the file (`index.tsx` and `index.web.tsx`).
- Import with the `@/` alias (maps to `src/`), never deep relative paths across modules.

## Designs

- The designs are the JSX export of the Claude Design project in `frontend/design/` (screens in `rupiverse-*.jsx`,
tokens in `rupiverse-theme.jsx`, artboards in `Rupiverse.html`). Open them before building a screen and port them.
- The Spec Doc (linked from the ClickUp ticket) says which states each screen has. Build every state, not just the
happy path.
- Never invent UI. If a state or element is missing from the design, ask @pm in the room instead of guessing.
- Themes: Calm (light) and Midnight (dark), following the device setting. Font: Geist, loaded with `expo-font`.

## Reuse before building

Never hand-build what exists. Check in order: repo (`src/components`, `src/hooks`) -> Expo / Expo Router / Expo UI
(read the versioned docs) -> well-maintained library (check peer deps + last publish; `npx expo install`) -> build it
small. Say why in the PR when adding a library or keeping custom code.

## Shared components and theme

Match the neatness of the default Expo starter (what `create-expo-app` generates:
https://github.com/expo/expo/tree/main/templates/expo-template-default), in our folder-per-component layout.

- Use `ThemedText` / `ThemedView` (`src/components`), not raw `Text`/`View` with ad-hoc fonts/colours. New text style =
new `ThemedText` `type`.
- Tokens only from `src/constants/theme.ts` (`Colors`, `Fonts`, `Radius`, `Spacing`, `MaxContentWidth`). Design-only
numbers stay in the module's `constants.ts`.
- Used by more than one module, or generic (button, input, badge, card) -> `src/components/<name>/`.
- `src/app/**` only re-exports from `src/modules/<name>` (root layout: `modules/root-layout`).

## API, auth and errors

- Hooks call `api.<module>.<method>()` from `@/services`. They never import `api.ts`, `mock.ts` or `http.ts`
directly, so they can't tell live from mock.
- Live HTTP goes through `src/services/http.ts`; base URL from `EXPO_PUBLIC_API_URL`. Nothing else calls `fetch`.
- Tokens live behind one helper in `src/services/auth-storage.ts`: `expo-secure-store` on native, `localStorage` on
web (`auth-storage.web.ts`). Nothing else reads or writes tokens.
- The API returns errors as `{"error": "<code>", "detail": "..."}`. Map each `error` code to friendly text in the
module's `constants.ts`; never show raw server text to users.
- Routing guards live in the layouts: signed-out users go to Login, signed-in users go to Home, unverified users go to
Verify code.

## Mocks and test data

One switch makes the whole frontend run without a backend: `EXPO_PUBLIC_API_MODE=mock` (default `live`).
`src/services/index.ts` reads it once and exports either every module's `api.ts` or every module's `mock.ts`.

**The contract comes from the backend.** `npm run gen:api` turns the backend's OpenAPI into `src/types/api.gen.ts`.
Each module's `types.ts` re-exports from it, and both `api.ts` and `mock.ts` implement the same interface typed with
those types. If the backend changes a response, `tsc` fails in the mock too, so mocks can't drift.

**Per module, per endpoint, the same shape every time:**

```ts
// src/services/auth/types.ts
import type { components } from '@/types/api.gen';
export type LoginRequest = components['schemas']['LoginRequest'];
export type TokenPair = components['schemas']['TokenPair'];
export interface AuthApi {
    login(body: LoginRequest): Promise<TokenPair>;
    // signup, verify, resend, refresh, logout, me ...
}

// src/services/auth/fixtures.ts
export const users = {
    verified: { id: 'u-1', email: 'demo@rupiverse.app', password: 'Demo@1234', verified: true },
    unverified: { id: 'u-2', email: 'new@rupiverse.app', password: 'Demo@1234', verified: false },
} as const;
export const tokens: TokenPair = { access_token: 'mock-access', refresh_token: 'mock-refresh', token_type: 'bearer' };
export const scenarios = {
    login: ['ok', 'invalid_credentials', 'email_not_verified', 'server_error'],
    verify: ['ok', 'code_invalid', 'code_expired', 'code_locked'],
} as const;
export const MOCK_CODE = '123456';

// src/services/auth/mock.ts — behaves like the real API over the in-memory db
export const authMock: AuthApi = {
    async login(body) {
        await mockControl.delay();
        const forced = mockControl.scenario('auth.login');      // 'ok' unless a test/dev forced one
        if (forced !== 'ok') throw mockControl.errorFor('auth.login', forced);
        const user = mockDb.users.findByEmail(body.email);
        if (!user || user.password !== body.password) throw new ApiError('invalid_credentials', 401, 'Wrong email or password');
        if (!user.verified) throw new ApiError('email_not_verified', 403, 'Verify your email');
        return tokens;
    },
};
```

**Rules**
- Every endpoint in the Spec's API section gets: a typed fixture, a stateful mock method, and one named scenario per
error code the Spec lists. Mocks throw the same `ApiError` codes as the backend.
- Mock state is realistic: signup creates a user in `mockDb`, verify flips `verified`, logout revokes. A full flow
(signup → verify → home → logout → login) must work in mock mode.
- In mock mode the email code is always `MOCK_CODE` (`123456`).
- `mockControl` (web: `window.__mock`) can: `setScenario('auth.login', 'server_error')`, `setLatency(ms)` (default
300), `reset()`. Playwright uses it to reach every error state; developers use it to look at them.
- Mock code never ships in a production build: `index.ts` imports mocks lazily, and only when the flag is `mock`.
- When a new backend module lands, add `src/services/<module>/` with the same four files before building screens.

## Platform insets

- `ScrollView.contentInset` is iOS-only: Android ignores it and web has no equivalent. So one screen needs three
treatments: iOS passes `contentInset`; Android puts the same numbers in `contentContainerStyle` padding (from
`useSafeAreaInsets()`); web uses fixed `Spacing` padding and centres content with `maxWidth: MaxContentWidth`.
- Per-platform values: `Platform.select({...}) ?? fallback`. Whole-UI differences: `.web.tsx` file.
- Never hard-code status bar / home indicator sizes.

## Responsive layout

- Never scale every number with the window width. Fonts, icons, paddings, radii and buttons keep a fixed size (the
design's, as dp). Only layout containers respond: how many columns, how wide a column or card is, how wide the content
column is.
- `useLayout()` (`src/hooks/use-layout.ts`) gives the width class, `contentWidth` (capped at `MAX_CONTENT_WIDTH`) and the
`margin` beside it; `pick({compact, medium, expanded})` chooses a per-class value. Breakpoints: compact < 600,
medium 600-1023, expanded >= 1024 or any wide, short window (a phone in landscape).
- Auth screens: split layout (brand panel left, form right) at expanded; single-column mobile layout below.
- A card's height comes from an aspect ratio, never from a scaled number.

## Testing

- Every interactive element and every screen state has a `testID` (`<module>-<element>`, e.g. `login-submit`), so
Playwright can find it.
- Unit tests cover hooks (logic) against the module's `mock.ts` and `fixtures.ts`; never hand-roll a different fake.
- E2E specs live in `e2e/rv<n>-*.spec.ts`, run on Expo web, and name the acceptance criterion they prove.
- Two Playwright projects in `playwright.config.ts`:
    - `mock`: Expo web with `EXPO_PUBLIC_API_MODE=mock`. Covers every screen state and every error code via
    `window.__mock.setScenario(...)`. Fast, no backend. Call `window.__mock.reset()` in `beforeEach`.
    - `live`: Expo web against the real backend on your port. Covers the end-to-end acceptance flows only.
- The frontend can be built and fully tested in mock mode before the backend PR is merged; say so in the PR.
- Test UI on web with Playwright at several sizes (360x740, 393x852, 430x932, 768x1024, 1180x820, 1440x900). Native
iOS/Android can't run here; the owner tests them, so say in the PR what is unverified.
- PRs open early as drafts. Open: structure follows this file and lint autofix has run. Hand to Tester: the app
starts on web. Awaiting merge: lint, `tsc`, unit tests and the relevant e2e specs all pass.
- All feedback lives on the PR as review comments, inline where possible. Room messages only point to the PR.

## Gotchas

- Dev server: never `CI=1` (disables file watching, edits not served). On SSR "unknown module" errors, restart it.
- Web SSR renders with window width 0: guard components that reject 0 sizes.
- Each agent runs Expo web on its own port (see its instructions); never use another agent's port.
- Reanimated: read `.value` inline inside `useAnimatedStyle`; shared helper closures are not tracked.
- RN 0.88: `StyleSheet.absoluteFillObject` is gone (use `absoluteFill`); ellipses need `borderRadius: '50%'`.
- Animate `transform`/`opacity`, never `width`/`height` (re-runs native layout every frame; jank on device).
- `expo-image` inside gesture areas on web: `draggable={false}`, or the browser cancels the gesture.
- Playwright `mouse.wheel` deltas arrive doubled in Chrome; log real `event.deltaX` before reading test results.
- SVGs with `mask`/`filter` render wrong or heavy with `expo-image` on Android: rasterize them at 3x to transparent
WebP. Plain path SVGs (logos, icons) stay SVG.

## Hygiene

- No trash: when a change makes an asset, file, token or dependency unused, delete it in the same change. Keep tool
output (`.playwright-mcp/`, `.DS_Store`, `.switch/`) out of git. Density files (`@2x`/`@3x`) look unreferenced but are
not.

## Code style

- Use a 4-space indent in all code files (TS/TSX/JS/JSON-config alike).
