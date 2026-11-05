// Shared helpers and the UI contract for the RV1 Playwright specs (Tester-owned).
//
// testIDs follow frontend/CLAUDE.md (`<module>-<element>`). Modules: login, signup, verify, forgot, forgot-code,
// reset, home, plus the shared auth layout (`auth-*`). The full list is in the RV1 Test report.
import {expect, type Locator, type Page, test as base} from "@playwright/test";

export const MOCK_CODE = "123456";
export const WRONG_CODE = "000000";

// Fixture users from src/services/auth/fixtures.ts (frontend/CLAUDE.md): one verified, one unverified.
export const VERIFIED = {email: "demo@rupiverse.app", password: "Demo@1234"};
export const UNVERIFIED = {email: "new@rupiverse.app", password: "Demo@1234"};
export const STRONG_PASSWORD = "Rupi@2026x";
export const NEW_PASSWORD = "Verse#2027y";

// Spec §9 copy that the screens must show.
export const TEXT = {
    loginTitle: "Welcome back",
    loginSub: "Log in to your Rupiverse.",
    signupTitle: "Create your account",
    signupSub: "Track every rupee across your accounts.",
    verifyTitle: "Verify your email",
    forgotTitle: "Reset your password",
    forgotSub: "Enter your email and we'll send a 6-digit reset code.",
    forgotCodeTitle: "Check your email",
    resetTitle: "Set a new password",
    resetSub: "Choose a strong password you don't use elsewhere.",
    tagline: "The rupee, in every form it takes in your life.",
    resetBanner: "Password updated. Log in with your new password.",
    invalidEmail: "Enter a valid email address",
    weakPassword: "Doesn't meet the requirements below",
    tooLong: "Password is too long (max 72 bytes)",
    mismatch: "Passwords don't match",
    codeInvalid: (n: number) => new RegExp(`Wrong code\\s*[—-]\\s*${n} attempts? left`),
    codeLocked: /Too many attempts\s*[—-]\s*resend a new code/,
    codeExpired: /Code expired\s*[—-]\s*resend/,
    resetExpired: /This reset link has expired\s*[—-]\s*start again/,
};

// Calm (light) and Midnight (dark) from frontend/design/rupiverse-theme.jsx.
export const THEME = {
    light: {page: "rgb(250, 250, 247)", accent: "rgb(31, 90, 80)", ink: "rgb(14, 14, 12)"},
    dark: {page: "rgb(14, 14, 16)", accent: "rgb(95, 181, 138)", ink: "rgb(237, 237, 234)"},
};

// Every §8 endpoint as a window.__mock scenario key, with every error code the Spec lists for it.
// `network_error` is the extra scenario for the "network error" screen state.
export const SCENARIOS: Record<string, string[]> = {
    "auth.signup": ["invalid_email", "password_too_short", "password_too_long", "password_too_weak", "email_taken",
        "email_send_failed", "network_error"],
    "auth.verify": ["code_invalid", "code_locked", "code_expired", "already_verified", "network_error"],
    "auth.resend": ["resend_too_soon", "already_verified", "network_error"],
    "auth.login": ["invalid_credentials", "email_not_verified", "network_error"],
    "auth.refresh": ["invalid_refresh_token", "network_error"],
    "auth.logout": ["network_error"],
    "auth.me": ["not_authenticated", "token_expired", "invalid_token", "network_error"],
    "auth.forgotPassword": ["invalid_email", "email_send_failed", "network_error"],
    "auth.verifyResetCode": ["code_invalid", "code_locked", "code_expired", "network_error"],
    "auth.resetPassword": ["invalid_reset_token", "password_too_short", "password_too_long", "password_too_weak",
        "network_error"],
};

export type MockControl = {
    setScenario(key: string, scenario: string): Promise<void>;
    setLatency(ms: number): Promise<void>;
    reset(): Promise<void>;
};

async function waitForMock(page: Page): Promise<void> {
    await page.waitForFunction(() => typeof (window as unknown as { __mock?: unknown }).__mock === "object");
}

// `mock` fixture: fresh state for every test (frontend/CLAUDE.md: call window.__mock.reset() in beforeEach).
export const test = base.extend<{ mock: MockControl }>({
    mock: async ({page}, provide) => {
        await page.goto("/");
        await waitForMock(page);
        await page.evaluate(() => {
            window.localStorage.clear();
            window.sessionStorage.clear();
            (window as unknown as { __mock: { reset(): void } }).__mock.reset();
        });
        const control: MockControl = {
            setScenario: async (key, scenario) => {
                await waitForMock(page);
                await page.evaluate(([k, s]) => {
                    (window as unknown as { __mock: { setScenario(a: string, b: string): void } })
                        .__mock.setScenario(k, s);
                }, [key, scenario] as const);
            },
            setLatency: async (ms) => {
                await waitForMock(page);
                await page.evaluate((v) => {
                    (window as unknown as { __mock: { setLatency(a: number): void } }).__mock.setLatency(v);
                }, ms);
            },
            reset: async () => {
                await waitForMock(page);
                await page.evaluate(() => (window as unknown as { __mock: { reset(): void } }).__mock.reset());
            },
        };
        await provide(control);
    },
});

export {expect};

export const id = (page: Page, testId: string): Locator => page.getByTestId(testId);

export async function open(page: Page, path: string): Promise<void> {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
}

export async function fill(page: Page, testId: string, value: string): Promise<void> {
    const field = id(page, testId);
    await field.click();
    await field.fill(value);
}

// OTP: `<module>-code-input` takes the whole code (typing or paste); cells are `<module>-code-cell-<0..5>`.
export async function enterCode(page: Page, module: "verify" | "forgot-code", code: string): Promise<void> {
    await fill(page, `${module}-code-input`, code);
}

export async function expectOnScreen(page: Page, module: string, urlPart?: RegExp): Promise<void> {
    await expect(id(page, `${module}-screen`)).toBeVisible();
    if (urlPart) {
        await expect(page).toHaveURL(urlPart);
    }
}

export async function logIn(page: Page, email = VERIFIED.email, password = VERIFIED.password): Promise<void> {
    await open(page, "/login");
    await fill(page, "login-email", email);
    await fill(page, "login-password", password);
    await id(page, "login-submit").click();
}

export async function signUp(page: Page, email: string, password = STRONG_PASSWORD): Promise<void> {
    await open(page, "/signup");
    await fill(page, "signup-email", email);
    await fill(page, "signup-password", password);
    await id(page, "signup-submit").click();
}

// The nearest painted background colour of an element (walks up through transparent ancestors).
export async function backgroundOf(locator: Locator): Promise<string> {
    return locator.evaluate((el) => {
        let node: Element | null = el;
        while (node) {
            const colour = getComputedStyle(node).backgroundColor;
            if (colour && colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") {
                return colour;
            }
            node = node.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
    });
}

export const uniqueEmail = (tag: string): string =>
    `rv1-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;

export const AUTH_SCREENS = [
    {module: "login", path: "/login", hasBack: false},
    {module: "signup", path: "/signup", hasBack: false},
    {module: "verify", path: "/verify", hasBack: true},
    {module: "forgot", path: "/forgot", hasBack: true},
    {module: "forgot-code", path: "/forgot-code", hasBack: true},
    {module: "reset", path: "/reset", hasBack: true},
] as const;

// Reach a screen through the real flow, so screens that need state (email, reset token) render.
export async function reach(page: Page, module: (typeof AUTH_SCREENS)[number]["module"]): Promise<void> {
    switch (module) {
        case "login":
        case "signup":
            await open(page, `/${module}`);
            break;
        case "verify":
            await signUp(page, uniqueEmail("reach"));
            break;
        case "forgot":
            await open(page, "/forgot");
            break;
        case "forgot-code":
            await open(page, "/forgot");
            await fill(page, "forgot-email", VERIFIED.email);
            await id(page, "forgot-submit").click();
            break;
        case "reset":
            await reach(page, "forgot-code");
            await enterCode(page, "forgot-code", MOCK_CODE);
            await id(page, "forgot-code-submit").click();
            break;
    }
    await expectOnScreen(page, module);
}
