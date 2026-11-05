// RV1 · Home placeholder + routing guards (mock project): AC18 (Home), AC22.
import {expect, expectOnScreen, id, logIn, open, test, VERIFIED} from "./support/rv1";

test.describe("RV1 Home placeholder", () => {
    test("AC18: loaded state shows the /me email and Logout", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home", /\/home/);
        await expect(id(page, "home-email")).toContainText(`Signed in as ${VERIFIED.email}`);
        await expect(id(page, "home-logout")).toBeVisible();
    });

    test("AC18: loading state while /me is in flight", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await mock.setLatency(3000);
        await page.reload();
        await expect(id(page, "home-loading")).toBeVisible();
        await expect(id(page, "home-email")).toContainText(VERIFIED.email, {timeout: 15_000});
    });

    test("AC18: error state when /me fails", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await mock.setScenario("auth.me", "network_error");
        await page.reload();
        await expect(id(page, "home-error")).toBeVisible();
    });

    test("AC18: Logout → Login, tokens cleared", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await id(page, "home-logout").click();
        await expectOnScreen(page, "login", /\/login/);
        await open(page, "/home");
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC18: Logout clears tokens even when the logout call fails", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await mock.setScenario("auth.logout", "network_error");
        await id(page, "home-logout").click();
        await expectOnScreen(page, "login", /\/login/);
        await page.reload();
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC10 / AC22: an invalid session (/me 401) clears tokens and goes to Login", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await mock.setScenario("auth.me", "invalid_token");
        await mock.setScenario("auth.refresh", "invalid_refresh_token");
        await page.reload();
        await expectOnScreen(page, "login", /\/login/);
    });
});

test.describe("RV1 Routing guards", () => {
    test("AC22: the app opens on Login with no session", async ({page, mock}) => {
        await open(page, "/");
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC22: signed-out user opening /home → Login", async ({page, mock}) => {
        await open(page, "/home");
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC22 / AC21: the app opens on Home with a session, and it survives a reload", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await page.reload();
        await expectOnScreen(page, "home", /\/home/);
        await open(page, "/");
        await expectOnScreen(page, "home", /\/home/);
    });

    for (const path of ["/login", "/signup", "/verify", "/forgot", "/forgot-code", "/reset"]) {
        test(`AC22: signed-in user opening ${path} → Home`, async ({page, mock}) => {
            await logIn(page);
            await expectOnScreen(page, "home");
            await open(page, path);
            await expectOnScreen(page, "home", /\/home/);
        });
    }

    test("AC22: Verify email opened directly without an email → Signup", async ({page, mock}) => {
        await open(page, "/verify");
        await expectOnScreen(page, "signup", /\/signup/);
        await expect(id(page, "verify-screen")).toHaveCount(0);
    });
});
