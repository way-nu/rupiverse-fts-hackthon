// RV1 · Signup screen (mock project): AC3 (client side), AC18 (signup states), AC27 (scenarios).
import {expect, expectOnScreen, fill, id, open, signUp, STRONG_PASSWORD, test, TEXT, uniqueEmail, VERIFIED} from "./support/rv1";

const RULES = ["length", "upper", "lower", "number", "special"] as const;

async function expectRules(page: import("@playwright/test").Page, ok: Partial<Record<(typeof RULES)[number], boolean>>) {
    for (const rule of RULES) {
        await expect(id(page, `signup-rule-${rule}`)).toHaveAttribute("aria-checked", String(ok[rule] ?? false));
    }
}

test.describe("RV1 Signup", () => {
    test("AC18: idle state: copy, email + password only, rules checklist, submit disabled", async ({page, mock}) => {
        await open(page, "/signup");
        await expectOnScreen(page, "signup", /\/signup/);
        await expect(id(page, "signup-screen")).toContainText(TEXT.signupTitle);
        await expect(id(page, "signup-screen")).toContainText(TEXT.signupSub);
        await expect(id(page, "signup-email")).toBeVisible();
        await expect(id(page, "signup-password")).toBeVisible();
        await expect(id(page, "signup-rules")).toBeVisible();
        await expect(id(page, "signup-submit")).toContainText("Create account");
        await expect(id(page, "signup-submit")).toBeDisabled();
        await expect(id(page, "signup-login-link")).toContainText("Log in");
    });

    test("AC18: no Name, Age, Gender or Phone fields", async ({page, mock}) => {
        await open(page, "/signup");
        for (const field of ["name", "age", "gender", "phone"]) {
            await expect(id(page, `signup-${field}`)).toHaveCount(0);
        }
        const screen = id(page, "signup-screen");
        for (const label of [/\bName\b/, /\bAge\b/, /\bGender\b/, /\bPhone\b/, /\+91/]) {
            await expect(screen).not.toContainText(label);
        }
    });

    test("AC3: rules checklist shows all five rules including 1 lowercase", async ({page, mock}) => {
        await open(page, "/signup");
        const rules = id(page, "signup-rules");
        for (const label of ["8+ characters", "1 uppercase", "1 lowercase", "1 number", "1 special char"]) {
            await expect(rules).toContainText(label);
        }
        await expectRules(page, {});
    });

    test("AC3: each rule ticks as the password meets it", async ({page, mock}) => {
        await open(page, "/signup");
        await fill(page, "signup-password", "a");
        await expectRules(page, {lower: true});
        await fill(page, "signup-password", "aB");
        await expectRules(page, {lower: true, upper: true});
        await fill(page, "signup-password", "aB3");
        await expectRules(page, {lower: true, upper: true, number: true});
        await fill(page, "signup-password", "aB3!");
        await expectRules(page, {lower: true, upper: true, number: true, special: true});
        await fill(page, "signup-password", "aB3!wxyz");
        await expectRules(page, {lower: true, upper: true, number: true, special: true, length: true});
    });

    test("AC3: missing lowercase keeps Create account disabled", async ({page, mock}) => {
        await open(page, "/signup");
        await fill(page, "signup-email", uniqueEmail("lower"));
        await fill(page, "signup-password", "ABCD123!");
        await expect(id(page, "signup-submit")).toBeDisabled();
        await fill(page, "signup-password", "ABCd123!");
        await expect(id(page, "signup-submit")).toBeEnabled();
    });

    test("AC3: a password over 72 bytes shows the too-long error (multi-byte counts as bytes)", async ({page, mock}) => {
        await open(page, "/signup");
        await fill(page, "signup-email", uniqueEmail("long"));
        // 4 + 23 × 3 = 73 bytes, only 27 characters.
        await fill(page, "signup-password", "Ab1!" + "€".repeat(23));
        await expect(id(page, "signup-password-error")).toContainText(TEXT.tooLong);
        await expect(id(page, "signup-submit")).toBeDisabled();
        // 72 bytes is fine.
        await fill(page, "signup-password", "Ab1!" + "€".repeat(22) + "xx");
        await expect(id(page, "signup-password-error")).toHaveCount(0);
        await expect(id(page, "signup-submit")).toBeEnabled();
    });

    test("AC18: field errors as in signup-invalid", async ({page, mock}) => {
        await open(page, "/signup");
        await fill(page, "signup-email", "not-an-email");
        await fill(page, "signup-password", "weak");
        await id(page, "signup-password").blur();
        await expect(id(page, "signup-email-error")).toContainText(TEXT.invalidEmail);
        await expect(id(page, "signup-password-error")).toContainText(TEXT.weakPassword);
        await expect(id(page, "signup-submit")).toBeDisabled();
    });

    test("AC18: submitting state", async ({page, mock}) => {
        await mock.setLatency(3000);
        await signUp(page, uniqueEmail("busy"));
        await expect(id(page, "signup-submit")).toBeDisabled();
        await expectOnScreen(page, "verify", /\/verify/);
    });

    test("AC18: success → Verify email with the email", async ({page, mock}) => {
        const email = uniqueEmail("ok");
        await signUp(page, email);
        await expectOnScreen(page, "verify", /\/verify/);
        await expect(id(page, "verify-email")).toContainText(email);
    });

    test("AC18: email_taken (stateful) shows the error with a Log in link", async ({page, mock}) => {
        await signUp(page, VERIFIED.email);
        await expect(id(page, "signup-error")).toBeVisible();
        await expect(id(page, "signup-error-login")).toBeVisible();
        await id(page, "signup-error-login").click();
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC18 / AC27: forced email_taken scenario", async ({page, mock}) => {
        await mock.setScenario("auth.signup", "email_taken");
        await signUp(page, uniqueEmail("taken"));
        await expect(id(page, "signup-error")).toBeVisible();
        await expect(id(page, "signup-error-login")).toBeVisible();
        await expect(page).toHaveURL(/\/signup/);
    });

    test("AC18 / AC27: email_send_failed", async ({page, mock}) => {
        await mock.setScenario("auth.signup", "email_send_failed");
        await signUp(page, uniqueEmail("smtp"));
        await expect(id(page, "signup-error")).toBeVisible();
        await expect(id(page, "signup-error")).not.toContainText("email_send_failed");
        await expect(page).toHaveURL(/\/signup/);
    });

    test("AC18: network error", async ({page, mock}) => {
        await mock.setScenario("auth.signup", "network_error");
        await signUp(page, uniqueEmail("net"));
        await expect(id(page, "signup-error")).toBeVisible();
        await expect(page).toHaveURL(/\/signup/);
    });

    for (const code of ["password_too_short", "password_too_long", "password_too_weak", "invalid_email"]) {
        test(`AC3 / AC27: server-side ${code} is shown even if the client let it through`, async ({page, mock}) => {
            await mock.setScenario("auth.signup", code);
            await signUp(page, uniqueEmail("srv"), STRONG_PASSWORD);
            const anyError = page.locator("[data-testid='signup-error'], [data-testid='signup-email-error'], " +
                "[data-testid='signup-password-error']");
            await expect(anyError.first()).toBeVisible();
            await expect(page).toHaveURL(/\/signup/);
        });
    }

    test("AC18: footer Log in → Login", async ({page, mock}) => {
        await open(page, "/signup");
        await id(page, "signup-login-link").click();
        await expectOnScreen(page, "login", /\/login/);
    });
});
