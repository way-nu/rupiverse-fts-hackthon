// RV1 · End-to-end flows against the real backend (live project): AC21, AC22, AC6, AC3, AC19 (flows at both sizes).
// Backend runs with TEST_OUTBOX_ENABLED=true; codes come from GET /test/outbox/latest.
import {expect, test as base, type Page} from "@playwright/test";

import {
    enterCode,
    expectOnScreen,
    fill,
    id,
    logIn,
    NEW_PASSWORD,
    open,
    signUp,
    STRONG_PASSWORD,
    TEXT,
    uniqueEmail,
} from "./support/rv1";

const API_URL = `http://localhost:${process.env.API_PORT ?? 8002}`;
const test = base;

async function outboxCode(page: Page, email: string, purpose = "verify_email", previous?: string): Promise<string> {
    let code = "";
    await expect.poll(async () => {
        const response = await page.request.get(`${API_URL}/test/outbox/latest`, {params: {email, purpose}});
        if (!response.ok()) {
            return "";
        }
        code = (await response.json()).code;
        return code && code !== previous ? code : "";
    }, {timeout: 15_000}).not.toBe("");
    return code;
}

const wrongOf = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

async function signupAndVerify(page: Page, email: string, password = STRONG_PASSWORD): Promise<void> {
    await signUp(page, email, password);
    await expectOnScreen(page, "verify", /\/verify/);
    await enterCode(page, "verify", await outboxCode(page, email));
    await id(page, "verify-submit").click();
    await expectOnScreen(page, "home", /\/home/);
}

const SIZES = [
    {name: "desktop", viewport: {width: 1280, height: 820}, layout: "auth-layout-desktop"},
    {name: "mobile", viewport: {width: 390, height: 844}, layout: "auth-layout-mobile"},
];

for (const size of SIZES) {
    test.describe(`RV1 live flows · ${size.name}`, () => {
        test.use({viewport: size.viewport});

        test(`AC21 flow 1 (${size.name}): signup → verify → Home → reload → logout → login → Home`, async ({page}) => {
            const email = uniqueEmail(`live1-${size.name}`);
            await open(page, "/signup");
            await expect(id(page, size.layout)).toBeVisible();
            await signupAndVerify(page, email);
            await expect(id(page, "home-email")).toContainText(email);

            await page.reload();
            await expectOnScreen(page, "home", /\/home/);
            await expect(id(page, "home-email")).toContainText(email);

            await id(page, "home-logout").click();
            await expectOnScreen(page, "login", /\/login/);
            await logIn(page, email, STRONG_PASSWORD);
            await expectOnScreen(page, "home", /\/home/);
            await expect(id(page, "home-email")).toContainText(email);
        });

        test(`AC21 flow 5 (${size.name}): forgot → wrong code → code → mismatch → new password → login`,
            async ({page}) => {
                const email = uniqueEmail(`live5-${size.name}`);
                await signupAndVerify(page, email);
                await id(page, "home-logout").click();

                await open(page, "/login");
                await expect(id(page, size.layout)).toBeVisible();
                await id(page, "login-forgot").click();
                await fill(page, "forgot-email", email);
                await id(page, "forgot-submit").click();
                await expectOnScreen(page, "forgot-code", /\/forgot-code/);
                const code = await outboxCode(page, email, "reset_password");

                await enterCode(page, "forgot-code", wrongOf(code));
                await id(page, "forgot-code-submit").click();
                await expect(id(page, "forgot-code-error")).toContainText(TEXT.codeInvalid(2));
                await enterCode(page, "forgot-code", code);
                await id(page, "forgot-code-submit").click();
                await expectOnScreen(page, "reset", /\/reset/);

                await fill(page, "reset-password", NEW_PASSWORD);
                await fill(page, "reset-confirm", NEW_PASSWORD + "x");
                await id(page, "reset-confirm").blur();
                await expect(id(page, "reset-confirm-error")).toContainText(TEXT.mismatch);
                await fill(page, "reset-confirm", NEW_PASSWORD);
                await id(page, "reset-submit").click();
                await expectOnScreen(page, "login", /\/login/);
                await expect(id(page, "login-banner")).toContainText(TEXT.resetBanner);

                await logIn(page, email, STRONG_PASSWORD);
                await expect(id(page, "login-error")).toBeVisible();
                await logIn(page, email, NEW_PASSWORD);
                await expectOnScreen(page, "home", /\/home/);
            });
    });
}

test.describe("RV1 live flows", () => {
    test("AC6 flow 2: wrong code ×3 → locked → resend → verify succeeds", async ({page}) => {
        test.setTimeout(150_000);
        await page.clock.install();
        const email = uniqueEmail("live2");
        await signUp(page, email);
        await expectOnScreen(page, "verify", /\/verify/);
        const code = await outboxCode(page, email);
        for (const expected of [TEXT.codeInvalid(2), TEXT.codeInvalid(1), TEXT.codeLocked]) {
            await enterCode(page, "verify", wrongOf(code));
            await id(page, "verify-submit").click();
            await expect(id(page, "verify-error")).toContainText(expected);
        }
        // The server's 60 s rule runs on real time; the app's countdown on the page clock.
        await page.waitForTimeout(61_000);
        await page.clock.fastForward("01:01");
        await id(page, "verify-resend").click();
        const fresh = await outboxCode(page, email, "verify_email", code);
        await enterCode(page, "verify", fresh);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC22 flow 3: login before verifying → Verify email → verify → Home", async ({page}) => {
        const email = uniqueEmail("live3");
        await signUp(page, email);
        const code = await outboxCode(page, email);
        await logIn(page, email, STRONG_PASSWORD);
        await expectOnScreen(page, "verify", /\/verify/);
        await expect(id(page, "verify-email")).toContainText(email);
        await enterCode(page, "verify", code);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC3 / AC4 flow 4: rules checklist, >72-byte error, email_taken", async ({page}) => {
        const email = uniqueEmail("live4");
        await signupAndVerify(page, email);
        await id(page, "home-logout").click();

        await open(page, "/signup");
        await fill(page, "signup-email", uniqueEmail("live4b"));
        await fill(page, "signup-password", "Ab1!" + "€".repeat(23));
        await expect(id(page, "signup-password-error")).toContainText(TEXT.tooLong);
        await fill(page, "signup-password", "abcdefgh");
        await expect(id(page, "signup-rule-lower")).toHaveAttribute("aria-checked", "true");
        await expect(id(page, "signup-rule-upper")).toHaveAttribute("aria-checked", "false");
        await expect(id(page, "signup-submit")).toBeDisabled();

        await signUp(page, email.toUpperCase());
        await expect(id(page, "signup-error")).toBeVisible();
        await expect(id(page, "signup-error-login")).toBeVisible();
    });

    test("AC22 flow 6: /home signed out → Login; /login signed in → Home; /reset directly → Forgot", async ({page}) => {
        await open(page, "/home");
        await expectOnScreen(page, "login", /\/login/);
        await open(page, "/reset");
        await expectOnScreen(page, "forgot", /\/forgot$/);
        await signupAndVerify(page, uniqueEmail("live6"));
        await open(page, "/login");
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC10 / AC21: an expired access token is refreshed silently once (session handling)", async ({page}) => {
        await signupAndVerify(page, uniqueEmail("live7"));
        // Break every stored JWT-looking access token; the refresh token stays valid.
        await page.evaluate(() => {
            for (const key of Object.keys(window.localStorage)) {
                const value = window.localStorage.getItem(key) ?? "";
                window.localStorage.setItem(key, value.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, (jwt) => jwt.slice(0, -4) + "AAAA"));
            }
        });
        await page.reload();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC21: no console errors or failed API requests across the happy path", async ({page}) => {
        const problems: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") {
                problems.push(`console: ${msg.text()}`);
            }
        });
        page.on("response", (response) => {
            if (response.url().startsWith(API_URL) && response.status() >= 500) {
                problems.push(`${response.status()} ${response.url()}`);
            }
        });
        await signupAndVerify(page, uniqueEmail("live8"));
        await id(page, "home-logout").click();
        await expectOnScreen(page, "login", /\/login/);
        expect(problems).toEqual([]);
    });
});
