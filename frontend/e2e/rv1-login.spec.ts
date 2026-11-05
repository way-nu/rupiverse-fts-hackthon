// RV1 · Login screen (mock project): AC18 (login states), AC22 (unverified → Verify), AC27 (scenarios).
import {
    enterCode,
    expect,
    expectOnScreen,
    fill,
    id,
    logIn,
    MOCK_CODE,
    NEW_PASSWORD,
    open,
    reach,
    test,
    TEXT,
    UNVERIFIED,
    VERIFIED,
} from "./support/rv1";

test.describe("RV1 Login", () => {
    test("AC18: idle state matches the design copy and controls", async ({page, mock}) => {
        await open(page, "/login");
        await expectOnScreen(page, "login", /\/login/);
        await expect(id(page, "login-screen")).toContainText(TEXT.loginTitle);
        await expect(id(page, "login-screen")).toContainText(TEXT.loginSub);
        for (const testId of ["login-email", "login-password", "login-password-toggle", "login-forgot",
            "login-submit", "login-signup-link"]) {
            await expect(id(page, testId)).toBeVisible();
        }
        await expect(id(page, "login-submit")).toContainText("Log in");
        await expect(id(page, "login-forgot")).toContainText("Forgot?");
        await expect(id(page, "login-signup-link")).toContainText("Create an account");
        await expect(id(page, "login-error")).toHaveCount(0);
    });

    test("AC18: Google and phone buttons are disabled with a Soon badge and do nothing", async ({page, mock}) => {
        await open(page, "/login");
        for (const testId of ["login-google", "login-phone"]) {
            const button = id(page, testId);
            await expect(button).toBeVisible();
            await expect(button).toBeDisabled();
            await expect(button).toContainText("Soon");
            await button.click({force: true});
            await expect(page).toHaveURL(/\/login/);
        }
        await expect(id(page, "login-google")).toContainText("Google");
        await expect(id(page, "login-phone")).toContainText(/phone/i);
    });

    test("AC18: password eye toggle reveals and hides the password", async ({page, mock}) => {
        await open(page, "/login");
        await fill(page, "login-password", "Secret@123");
        await expect(id(page, "login-password")).toHaveAttribute("type", "password");
        await id(page, "login-password-toggle").click();
        await expect(id(page, "login-password")).not.toHaveAttribute("type", "password");
        await id(page, "login-password-toggle").click();
        await expect(id(page, "login-password")).toHaveAttribute("type", "password");
    });

    test("AC18: submitting state disables the button while the request is in flight", async ({page, mock}) => {
        await mock.setLatency(3000);
        await logIn(page);
        await expect(id(page, "login-submit")).toBeDisabled();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC18: success → Home", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home", /\/home/);
        await expect(id(page, "home-email")).toContainText(VERIFIED.email);
    });

    test("AC18: invalid_credentials (wrong password) shows an error and stays on Login", async ({page, mock}) => {
        await logIn(page, VERIFIED.email, "Wrong@Pass1");
        await expect(id(page, "login-error")).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
    });

    test("AC18: invalid_credentials for an unknown email looks the same as a wrong password", async ({page, mock}) => {
        await logIn(page, VERIFIED.email, "Wrong@Pass1");
        const wrongPassword = await id(page, "login-error").innerText();
        await logIn(page, "nobody@rupiverse.app", "Wrong@Pass1");
        await expect(id(page, "login-error")).toHaveText(wrongPassword);
    });

    test("AC18 / AC27: forced invalid_credentials scenario shows friendly text, not raw server detail",
        async ({page, mock}) => {
            await mock.setScenario("auth.login", "invalid_credentials");
            await logIn(page);
            await expect(id(page, "login-error")).toBeVisible();
            await expect(id(page, "login-error")).not.toContainText("invalid_credentials");
        });

    test("AC22: email_not_verified → Verify email with the email", async ({page, mock}) => {
        await logIn(page, UNVERIFIED.email, UNVERIFIED.password);
        await expectOnScreen(page, "verify", /\/verify/);
        await expect(id(page, "verify-email")).toContainText(UNVERIFIED.email);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC18 / AC27: forced email_not_verified scenario → Verify email", async ({page, mock}) => {
        await mock.setScenario("auth.login", "email_not_verified");
        await logIn(page);
        await expectOnScreen(page, "verify", /\/verify/);
    });

    test("AC18: network error shows an error and keeps the typed email", async ({page, mock}) => {
        await mock.setScenario("auth.login", "network_error");
        await logIn(page);
        await expect(id(page, "login-error")).toBeVisible();
        await expect(id(page, "login-email")).toHaveValue(VERIFIED.email);
        await expect(page).toHaveURL(/\/login/);
    });

    test("AC18: error clears after a successful retry", async ({page, mock}) => {
        await mock.setScenario("auth.login", "network_error");
        await logIn(page);
        await expect(id(page, "login-error")).toBeVisible();
        await mock.setScenario("auth.login", "ok");
        await id(page, "login-submit").click();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC18: success banner after a password reset", async ({page, mock}) => {
        await reach(page, "reset");
        await fill(page, "reset-password", NEW_PASSWORD);
        await fill(page, "reset-confirm", NEW_PASSWORD);
        await id(page, "reset-submit").click();
        await expectOnScreen(page, "login", /\/login/);
        await expect(id(page, "login-banner")).toContainText(TEXT.resetBanner);
    });

    test("AC18: no banner on a normal visit to Login", async ({page, mock}) => {
        await open(page, "/login");
        await expect(id(page, "login-banner")).toHaveCount(0);
    });

    test("AC18: Forgot? → Forgot password; Create an account → Signup", async ({page, mock}) => {
        await open(page, "/login");
        await id(page, "login-forgot").click();
        await expectOnScreen(page, "forgot", /\/forgot/);
        await open(page, "/login");
        await id(page, "login-signup-link").click();
        await expectOnScreen(page, "signup", /\/signup/);
    });
});
