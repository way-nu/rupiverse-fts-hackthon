// RV1 · Verify email screen (mock project): AC6/AC7/AC8 (client side), AC18 (verify states), AC27 (scenarios).
import {
    enterCode,
    expect,
    expectOnScreen,
    id,
    MOCK_CODE,
    signUp,
    test,
    TEXT,
    uniqueEmail,
    WRONG_CODE,
} from "./support/rv1";

test.describe("RV1 Verify email", () => {
    test("AC18: idle state: copy with the email, 6 cells, countdown, submit", async ({page, mock}) => {
        const email = uniqueEmail("idle");
        await signUp(page, email);
        await expectOnScreen(page, "verify", /\/verify/);
        await expect(id(page, "verify-screen")).toContainText(TEXT.verifyTitle);
        await expect(id(page, "verify-email")).toHaveText(email);
        for (let i = 0; i < 6; i++) {
            await expect(id(page, `verify-code-cell-${i}`)).toBeVisible();
        }
        await expect(id(page, "verify-countdown")).toContainText(/Resend in [01]:\d\d/);
        await expect(id(page, "verify-resend")).toHaveCount(0);
        await expect(id(page, "verify-submit")).toContainText("Verify email");
        await expect(id(page, "verify-change-email")).toContainText("Change email");
    });

    test("AC18: the code input takes digits only and fills all six cells (paste)", async ({page, mock}) => {
        await signUp(page, uniqueEmail("paste"));
        await enterCode(page, "verify", MOCK_CODE);
        for (let i = 0; i < 6; i++) {
            await expect(id(page, `verify-code-cell-${i}`)).toContainText(MOCK_CODE[i]);
        }
        await expect(id(page, "verify-code-input")).toHaveAttribute("inputmode", "numeric");
    });

    test("AC8: countdown runs 60 s, then becomes a Resend code link", async ({page, mock}) => {
        await page.clock.install();
        await signUp(page, uniqueEmail("count"));
        await expect(id(page, "verify-countdown")).toContainText(/Resend in (1:00|0:5\d)/);
        await page.clock.fastForward("00:30");
        await expect(id(page, "verify-countdown")).toContainText(/Resend in 0:[23]\d/);
        await page.clock.fastForward("00:31");
        await expect(id(page, "verify-resend")).toBeVisible();
        await expect(id(page, "verify-resend")).toContainText("Resend code");
        await expect(id(page, "verify-countdown")).toHaveCount(0);
    });

    test("AC18: success → tokens stored → Home", async ({page, mock}) => {
        const email = uniqueEmail("ok");
        await signUp(page, email);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home", /\/home/);
        await expect(id(page, "home-email")).toContainText(email);
    });

    test("AC18: submitting state", async ({page, mock}) => {
        await signUp(page, uniqueEmail("busy"));
        await mock.setLatency(3000);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-submit")).toBeDisabled();
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC6 / AC18: wrong codes count down 2, 1, then lock with cells disabled", async ({page, mock}) => {
        await signUp(page, uniqueEmail("lock"));
        await enterCode(page, "verify", WRONG_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-error")).toContainText(TEXT.codeInvalid(2));
        await enterCode(page, "verify", WRONG_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-error")).toContainText(TEXT.codeInvalid(1));
        await enterCode(page, "verify", WRONG_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-error")).toContainText(TEXT.codeLocked);
        await expect(id(page, "verify-code-input")).toBeDisabled();
    });

    test("AC6 / AC8: after the lock, resend clears the cells, restarts the countdown and the new code works",
        async ({page, mock}) => {
            await page.clock.install();
            await signUp(page, uniqueEmail("unlock"));
            for (let i = 0; i < 3; i++) {
                await enterCode(page, "verify", WRONG_CODE);
                await id(page, "verify-submit").click();
            }
            await expect(id(page, "verify-error")).toContainText(TEXT.codeLocked);
            await page.clock.fastForward("01:01");
            await id(page, "verify-resend").click();
            await expect(id(page, "verify-countdown")).toContainText(/Resend in (1:00|0:5\d)/);
            await expect(id(page, "verify-code-input")).toBeEnabled();
            await expect(id(page, "verify-code-input")).toHaveValue("");
            await expect(id(page, "verify-error")).toHaveCount(0);
            await enterCode(page, "verify", MOCK_CODE);
            await id(page, "verify-submit").click();
            await expectOnScreen(page, "home", /\/home/);
        });

    test("AC18 / AC27: forced code_locked scenario", async ({page, mock}) => {
        await signUp(page, uniqueEmail("flock"));
        await mock.setScenario("auth.verify", "code_locked");
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-error")).toContainText(TEXT.codeLocked);
        await expect(id(page, "verify-code-input")).toBeDisabled();
    });

    test("AC7 / AC18 / AC27: code_expired", async ({page, mock}) => {
        await signUp(page, uniqueEmail("exp"));
        await mock.setScenario("auth.verify", "code_expired");
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-error")).toContainText(TEXT.codeExpired);
    });

    test("AC8 / AC18 / AC27: resend_too_soon", async ({page, mock}) => {
        await page.clock.install();
        await signUp(page, uniqueEmail("soon"));
        await page.clock.fastForward("01:01");
        await mock.setScenario("auth.resend", "resend_too_soon");
        await id(page, "verify-resend").click();
        await expect(id(page, "verify-error")).toBeVisible();
        await expect(id(page, "verify-error")).not.toContainText("resend_too_soon");
    });

    test("AC18: resend sent shows the countdown again", async ({page, mock}) => {
        await page.clock.install();
        await signUp(page, uniqueEmail("sent"));
        await page.clock.fastForward("01:01");
        await id(page, "verify-resend").click();
        await expect(id(page, "verify-countdown")).toContainText(/Resend in (1:00|0:5\d)/);
    });

    test("AC18: network error on verify", async ({page, mock}) => {
        await signUp(page, uniqueEmail("net"));
        await mock.setScenario("auth.verify", "network_error");
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expect(id(page, "verify-error")).toBeVisible();
        await expect(page).toHaveURL(/\/verify/);
    });

    test("AC18: Change email → Signup with the email filled in", async ({page, mock}) => {
        const email = uniqueEmail("change");
        await signUp(page, email);
        await id(page, "verify-change-email").click();
        await expectOnScreen(page, "signup", /\/signup/);
        await expect(id(page, "signup-email")).toHaveValue(email);
    });

    test("AC18: back button → Signup with the email filled in", async ({page, mock}) => {
        const email = uniqueEmail("back");
        await signUp(page, email);
        await id(page, "auth-back").click();
        await expectOnScreen(page, "signup", /\/signup/);
        await expect(id(page, "signup-email")).toHaveValue(email);
    });
});
