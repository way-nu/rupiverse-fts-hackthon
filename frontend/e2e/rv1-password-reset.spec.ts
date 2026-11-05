// RV1 · Forgot password, Reset code, New password (mock project): AC3/AC6/AC7/AC16/AC17 (client side), AC18, AC22,
// AC27.
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
    VERIFIED,
    WRONG_CODE,
} from "./support/rv1";

test.describe("RV1 Forgot password", () => {
    test("AC18: idle state", async ({page, mock}) => {
        await open(page, "/forgot");
        await expectOnScreen(page, "forgot", /\/forgot/);
        await expect(id(page, "forgot-screen")).toContainText(TEXT.forgotTitle);
        await expect(id(page, "forgot-screen")).toContainText(TEXT.forgotSub);
        await expect(id(page, "forgot-email")).toBeVisible();
        await expect(id(page, "forgot-submit")).toContainText("Send reset code");
        await expect(id(page, "forgot-login-link")).toContainText("Back to log in");
        await expect(id(page, "auth-back")).toBeVisible();
    });

    test("AC18: invalid email", async ({page, mock}) => {
        await open(page, "/forgot");
        await fill(page, "forgot-email", "not-an-email");
        await id(page, "forgot-email").blur();
        await expect(id(page, "forgot-email-error")).toContainText(TEXT.invalidEmail);
        await expect(id(page, "forgot-submit")).toBeDisabled();
    });

    test("AC18: submitting state", async ({page, mock}) => {
        await mock.setLatency(3000);
        await open(page, "/forgot");
        await fill(page, "forgot-email", VERIFIED.email);
        await id(page, "forgot-submit").click();
        await expect(id(page, "forgot-submit")).toBeDisabled();
        await expectOnScreen(page, "forgot-code", /\/forgot-code/);
    });

    test("AC15 / AC18: an unknown email still goes to Reset code (no enumeration)", async ({page, mock}) => {
        await open(page, "/forgot");
        await fill(page, "forgot-email", "nobody@rupiverse.app");
        await id(page, "forgot-submit").click();
        await expectOnScreen(page, "forgot-code", /\/forgot-code/);
        await expect(id(page, "forgot-code-email")).toHaveText("nobody@rupiverse.app");
    });

    for (const scenario of ["email_send_failed", "network_error", "invalid_email"]) {
        test(`AC18 / AC27: ${scenario} shows an error and stays on Forgot`, async ({page, mock}) => {
            await mock.setScenario("auth.forgotPassword", scenario);
            await open(page, "/forgot");
            await fill(page, "forgot-email", VERIFIED.email);
            await id(page, "forgot-submit").click();
            const error = page.locator("[data-testid='forgot-error'], [data-testid='forgot-email-error']");
            await expect(error.first()).toBeVisible();
            await expect(error.first()).not.toContainText(scenario);
            await expect(page).toHaveURL(/\/forgot$/);
        });
    }

    test("AC18: Back to log in and the back button → Login", async ({page, mock}) => {
        await open(page, "/forgot");
        await id(page, "forgot-login-link").click();
        await expectOnScreen(page, "login", /\/login/);
        await open(page, "/forgot");
        await id(page, "auth-back").click();
        await expectOnScreen(page, "login", /\/login/);
    });
});

test.describe("RV1 Reset code", () => {
    test("AC18: idle state with the email, cells, countdown first", async ({page, mock}) => {
        await reach(page, "forgot-code");
        await expect(id(page, "forgot-code-screen")).toContainText(TEXT.forgotCodeTitle);
        await expect(id(page, "forgot-code-email")).toHaveText(VERIFIED.email);
        for (let i = 0; i < 6; i++) {
            await expect(id(page, `forgot-code-code-cell-${i}`)).toBeVisible();
        }
        await expect(id(page, "forgot-code-countdown")).toContainText(/Resend in [01]:\d\d/);
        await expect(id(page, "forgot-code-submit")).toContainText("Verify code");
    });

    test("AC15 / AC18: after 60 s Resend code is offered and restarts the countdown", async ({page, mock}) => {
        await page.clock.install();
        await reach(page, "forgot-code");
        await expect(id(page, "forgot-code-resend")).toHaveCount(0);
        await page.clock.fastForward("01:01");
        await expect(id(page, "forgot-code-resend")).toContainText("Resend code");
        await id(page, "forgot-code-resend").click();
        await expect(id(page, "forgot-code-countdown")).toContainText(/Resend in (1:00|0:5\d)/);
    });

    test("AC6 / AC18: wrong codes count down 2, 1, then lock; resend unlocks", async ({page, mock}) => {
        await page.clock.install();
        await reach(page, "forgot-code");
        for (const expected of [TEXT.codeInvalid(2), TEXT.codeInvalid(1), TEXT.codeLocked]) {
            await enterCode(page, "forgot-code", WRONG_CODE);
            await id(page, "forgot-code-submit").click();
            await expect(id(page, "forgot-code-error")).toContainText(expected);
        }
        await expect(id(page, "forgot-code-code-input")).toBeDisabled();
        await page.clock.fastForward("01:01");
        await id(page, "forgot-code-resend").click();
        await expect(id(page, "forgot-code-code-input")).toBeEnabled();
        await enterCode(page, "forgot-code", MOCK_CODE);
        await id(page, "forgot-code-submit").click();
        await expectOnScreen(page, "reset", /\/reset/);
    });

    for (const [scenario, text] of [["code_locked", TEXT.codeLocked], ["code_expired", TEXT.codeExpired]] as const) {
        test(`AC6 / AC7 / AC27: forced ${scenario}`, async ({page, mock}) => {
            await reach(page, "forgot-code");
            await mock.setScenario("auth.verifyResetCode", scenario);
            await enterCode(page, "forgot-code", MOCK_CODE);
            await id(page, "forgot-code-submit").click();
            await expect(id(page, "forgot-code-error")).toContainText(text);
        });
    }

    test("AC18: network error on verify code", async ({page, mock}) => {
        await reach(page, "forgot-code");
        await mock.setScenario("auth.verifyResetCode", "network_error");
        await enterCode(page, "forgot-code", MOCK_CODE);
        await id(page, "forgot-code-submit").click();
        await expect(id(page, "forgot-code-error")).toBeVisible();
        await expect(page).toHaveURL(/\/forgot-code/);
    });

    test("AC22: Reset code without an email → Forgot", async ({page, mock}) => {
        await open(page, "/forgot-code");
        await expectOnScreen(page, "forgot", /\/forgot$/);
    });
});

test.describe("RV1 New password", () => {
    test("AC18: idle state: copy, two fields, rules, disabled submit", async ({page, mock}) => {
        await reach(page, "reset");
        await expect(id(page, "reset-screen")).toContainText(TEXT.resetTitle);
        await expect(id(page, "reset-screen")).toContainText(TEXT.resetSub);
        await expect(id(page, "reset-password")).toBeVisible();
        await expect(id(page, "reset-confirm")).toBeVisible();
        await expect(id(page, "reset-rules")).toContainText("1 lowercase");
        await expect(id(page, "reset-submit")).toContainText("Update password");
        await expect(id(page, "reset-submit")).toBeDisabled();
    });

    test("AC18: Passwords don't match keeps Update password disabled", async ({page, mock}) => {
        await reach(page, "reset");
        await fill(page, "reset-password", NEW_PASSWORD);
        await fill(page, "reset-confirm", NEW_PASSWORD + "x");
        await id(page, "reset-confirm").blur();
        await expect(id(page, "reset-confirm-error")).toContainText(TEXT.mismatch);
        await expect(id(page, "reset-submit")).toBeDisabled();
        await fill(page, "reset-confirm", NEW_PASSWORD);
        await expect(id(page, "reset-confirm-error")).toHaveCount(0);
        await expect(id(page, "reset-submit")).toBeEnabled();
    });

    test("AC3: weak and over-72-byte passwords keep Update password disabled", async ({page, mock}) => {
        await reach(page, "reset");
        for (const weak of ["short1!", "nouppercase1!", "NOLOWERCASE1!", "NoDigits!!", "NoSpecial11"]) {
            await fill(page, "reset-password", weak);
            await fill(page, "reset-confirm", weak);
            await expect(id(page, "reset-submit")).toBeDisabled();
        }
        const long = "Ab1!" + "€".repeat(23);
        await fill(page, "reset-password", long);
        await fill(page, "reset-confirm", long);
        await expect(id(page, "reset-password-error")).toContainText(TEXT.tooLong);
        await expect(id(page, "reset-submit")).toBeDisabled();
    });

    test("AC18: submitting state", async ({page, mock}) => {
        await reach(page, "reset");
        await mock.setLatency(3000);
        await fill(page, "reset-password", NEW_PASSWORD);
        await fill(page, "reset-confirm", NEW_PASSWORD);
        await id(page, "reset-submit").click();
        await expect(id(page, "reset-submit")).toBeDisabled();
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC16 / AC18 / AC27: invalid_reset_token → message with a link back to Forgot", async ({page, mock}) => {
        await reach(page, "reset");
        await mock.setScenario("auth.resetPassword", "invalid_reset_token");
        await fill(page, "reset-password", NEW_PASSWORD);
        await fill(page, "reset-confirm", NEW_PASSWORD);
        await id(page, "reset-submit").click();
        await expect(id(page, "reset-error")).toContainText(TEXT.resetExpired);
        await id(page, "reset-restart").click();
        await expectOnScreen(page, "forgot", /\/forgot$/);
    });

    test("AC18: network error", async ({page, mock}) => {
        await reach(page, "reset");
        await mock.setScenario("auth.resetPassword", "network_error");
        await fill(page, "reset-password", NEW_PASSWORD);
        await fill(page, "reset-confirm", NEW_PASSWORD);
        await id(page, "reset-submit").click();
        await expect(id(page, "reset-error")).toBeVisible();
        await expect(page).toHaveURL(/\/reset/);
    });

    test("AC17 / AC18: success → stored tokens cleared → Login banner; new password works, old fails",
        async ({page, mock}) => {
            await logIn(page);
            await expectOnScreen(page, "home", /\/home/);
            await id(page, "home-logout").click();
            await expectOnScreen(page, "login");
            await reach(page, "reset");
            await fill(page, "reset-password", NEW_PASSWORD);
            await fill(page, "reset-confirm", NEW_PASSWORD);
            await id(page, "reset-submit").click();
            await expectOnScreen(page, "login", /\/login/);
            await expect(id(page, "login-banner")).toContainText(TEXT.resetBanner);

            await logIn(page, VERIFIED.email, VERIFIED.password);
            await expect(id(page, "login-error")).toBeVisible();
            await logIn(page, VERIFIED.email, NEW_PASSWORD);
            await expectOnScreen(page, "home", /\/home/);
        });

    test("AC22: reset token is held in memory only: a reload of New password → Forgot", async ({page, mock}) => {
        await reach(page, "reset");
        const stored = await page.evaluate(() => JSON.stringify({...window.localStorage, ...window.sessionStorage}));
        expect(stored).not.toMatch(/reset_token|resetToken/);
        await page.reload();
        await expectOnScreen(page, "forgot", /\/forgot$/);
    });

    test("AC22: New password opened directly → Forgot", async ({page, mock}) => {
        await open(page, "/reset");
        await expectOnScreen(page, "forgot", /\/forgot$/);
    });
});
