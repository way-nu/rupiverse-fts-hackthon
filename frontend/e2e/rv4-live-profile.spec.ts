// RV4 · Profile end to end against the real backend (live project): AC8, AC9, AC11, AC13, AC14 flow on live, AC4.
// Backend runs with TEST_OUTBOX_ENABLED=true; signup codes come from GET /test/outbox/latest.
import {expect, type Page, test} from "@playwright/test";

import {enterCode, expectOnScreen, id, logIn, open, signUp, STRONG_PASSWORD, uniqueEmail} from "./support/rv1";
import {expectGender, genderOption, setText} from "./support/rv4";

const API_URL = `http://localhost:${process.env.API_PORT ?? 8002}`;

async function outboxCode(page: Page, email: string): Promise<string> {
    let code = "";
    await expect.poll(async () => {
        const response = await page.request.get(`${API_URL}/test/outbox/latest`, {params: {email, purpose: "verify_email"}});
        code = response.ok() ? (await response.json()).code : "";
        return code;
    }, {timeout: 15_000}).not.toBe("");
    return code;
}

async function newVerifiedUser(page: Page): Promise<string> {
    const email = uniqueEmail("rv4");
    await signUp(page, email);
    await expectOnScreen(page, "verify", /\/verify/);
    await enterCode(page, "verify", await outboxCode(page, email));
    await id(page, "verify-submit").click();
    await expectOnScreen(page, "home", /\/home/);
    return email;
}

const isProfilePut = (url: string, method: string) => method === "PUT" && new URL(url).pathname === "/profile";

test.describe("RV4 live profile", () => {
    test("AC8 / AC9 / AC11 / AC4: login → Home → Profile → save → reload → values persist → clear a field", async ({page}) => {
        const email = await newVerifiedUser(page);
        const emailInitial = email[0].toUpperCase();

        await expect(id(page, "home-profile")).toHaveText(emailInitial);
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile", /\/profile/);
        await expect(id(page, "profile-email")).toHaveValue(email);
        await expect(id(page, "profile-name")).toHaveValue("");

        await setText(id(page, "profile-name"), "  Venu Gopal  ");
        await setText(id(page, "profile-age"), "29");
        await id(page, "profile-phone").click();
        await page.keyboard.type("98765 43210");
        await id(page, "profile-phone").blur();
        await genderOption(page, "male").click();

        const request = page.waitForRequest((r) => isProfilePut(r.url(), r.method()));
        const response = page.waitForResponse((r) => isProfilePut(r.url(), r.request().method()));
        await id(page, "profile-save").click();
        const sent = (await request).postDataJSON();
        expect(Object.keys(sent).sort()).toEqual(["age", "full_name", "gender", "phone"]);
        expect(sent.phone).toBe("9876543210");
        expect(sent.age).toBe(29);
        expect(sent.gender).toBe("male");
        expect(String(sent.full_name).trim()).toBe("Venu Gopal");
        expect((await response).status()).toBe(200);

        await expectOnScreen(page, "home", /\/home/);
        await expect(id(page, "home-profile")).toHaveText("V");

        await page.reload();
        await expect(id(page, "home-profile")).toHaveText("V");
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expect(id(page, "profile-name")).toHaveValue("Venu Gopal");
        await expect(id(page, "profile-age")).toHaveValue("29");
        await expect.poll(async () => (await id(page, "profile-phone").inputValue()).replace(/\D/g, "")).toBe("9876543210");
        await expectGender(page, "male");

        // Clear the name: the tile falls back to the email's initial, and the server returns null.
        await setText(id(page, "profile-name"), "");
        const cleared = page.waitForResponse((r) => isProfilePut(r.url(), r.request().method()));
        await id(page, "profile-save").click();
        const clearedBody = await (await cleared).json();
        expect(clearedBody.full_name).toBeNull();
        expect(clearedBody.phone).toBe("9876543210");
        await expectOnScreen(page, "home", /\/home/);
        await expect(id(page, "home-profile")).toHaveText(emailInitial);
        await page.reload();
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expect(id(page, "profile-name")).toHaveValue("");
        await expect(id(page, "profile-age")).toHaveValue("29");
    });

    test("AC7 (UI): a second account sees an empty profile", async ({page}) => {
        await newVerifiedUser(page);
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await setText(id(page, "profile-name"), "First Person");
        await id(page, "profile-save").click();
        await expectOnScreen(page, "home", /\/home/);
        await id(page, "home-logout").click();
        await expectOnScreen(page, "login", /\/login/);

        const second = await newVerifiedUser(page);
        await expect(id(page, "home-profile")).toHaveText(second[0].toUpperCase());
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expect(id(page, "profile-name")).toHaveValue("");
        await expect(id(page, "profile-email")).toHaveValue(second);
    });

    test("AC13: signed out, /profile goes to Login", async ({page}) => {
        await open(page, "/profile");
        await expectOnScreen(page, "login", /\/login/);
    });

    test("AC6 / ruling 11: an invalid session on /profile signs out to Login", async ({page}) => {
        const email = await newVerifiedUser(page);
        await page.evaluate(() => {
            for (const key of Object.keys(window.localStorage)) {
                const value = window.localStorage.getItem(key) ?? "";
                if (/^ey[\w-]+\.[\w-]+\.[\w-]+$/.test(value) || /token/i.test(key)) {
                    window.localStorage.setItem(key, "not.a.jwt");
                    continue;
                }
                // The session is stored as JSON ({accessToken, refreshToken}); tamper every token field in it.
                let parsed: unknown;
                try {
                    parsed = JSON.parse(value);
                } catch {
                    continue;
                }
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    const record = parsed as Record<string, unknown>;
                    const keys = Object.keys(record).filter((k) => /token/i.test(k) && typeof record[k] === "string");
                    if (keys.length) {
                        keys.forEach((k) => (record[k] = "not.a.jwt"));
                        window.localStorage.setItem(key, JSON.stringify(record));
                    }
                }
            }
        });
        await open(page, "/profile");
        await expectOnScreen(page, "login", /\/login/);
        await logIn(page, email, STRONG_PASSWORD);
        await expectOnScreen(page, "home", /\/home/);
    });
});
