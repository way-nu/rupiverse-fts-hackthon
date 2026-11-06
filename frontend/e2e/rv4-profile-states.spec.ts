// RV4 · Profile load states, form layout, guards (mock project): AC9, AC13, AC6 (401 handling, PM ruling 11).
import {
    expect,
    expectGender,
    expectOnScreen,
    expectProfile,
    FIELD_IDS,
    id,
    logIn,
    open,
    openProfile,
    saveProfile,
    test,
    TEXT,
    UNAUTHORISED,
    VERIFIED,
} from "./support/rv4";

test.describe("RV4 Profile load states (AC9)", () => {
    test("AC9: loading state, then the form", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await mock.setLatency(4000);
        await id(page, "home-profile").click();
        await expect(id(page, "profile-loading")).toBeVisible();
        await expect(id(page, "profile-name")).toHaveCount(0);
        await expect(id(page, "profile-save")).toHaveCount(0);
        await expect(id(page, "profile-screen")).toBeVisible({timeout: 15_000});
        await expect(id(page, "profile-loading")).toHaveCount(0);
    });

    test("AC9: empty state for a never-saved profile: empty fields, email filled, Save enabled", async ({page, mock}) => {
        await openProfile(page);
        await expect(id(page, "profile-title")).toHaveText(TEXT.title);
        await expectProfile(page, {name: "", age: "", gender: null, phone: ""});
        await expect(id(page, "profile-save")).not.toHaveAttribute("aria-disabled", "true");
    });

    test("AC9: filled state is pre-filled from GET /profile", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, {name: "Venu Gopal", age: "29", gender: "male", phone: "9876543210"});
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expectProfile(page, {name: "Venu Gopal", age: "29", gender: "male", phone: "9876543210"});
    });

    test("AC9: Email is read-only and shows the account email", async ({page, mock}) => {
        await openProfile(page);
        const email = id(page, "profile-email");
        await expect(email).toHaveValue(VERIFIED.email);
        await expect(email).toHaveAttribute("readonly", /.*/);
        await email.click();
        await page.keyboard.type("x");
        await expect(email).toHaveValue(VERIFIED.email);
    });

    for (const scenario of ["internal_error", "network_error"]) {
        test(`AC9: load error (${scenario}) shows the error state; Retry recovers`, async ({page, mock}) => {
            await logIn(page);
            await expectOnScreen(page, "home");
            await mock.setScenario("profile.get", scenario);
            await id(page, "home-profile").click();
            await expect(id(page, "profile-error")).toBeVisible();
            await expect(id(page, "profile-error")).toContainText(TEXT.loadError);
            await expect(id(page, "profile-name")).toHaveCount(0);
            await expect(id(page, "profile-retry")).toBeVisible();
            await mock.setScenario("profile.get", "ok");
            await id(page, "profile-retry").click();
            await expect(id(page, "profile-screen")).toBeVisible();
            await expect(id(page, "profile-error")).toHaveCount(0);
            await expect(id(page, "profile-email")).toHaveValue(VERIFIED.email);
        });
    }

    test("AC9: Retry while the server still fails keeps the error state", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await mock.setScenario("profile.get", "internal_error");
        await id(page, "home-profile").click();
        await expect(id(page, "profile-error")).toBeVisible();
        await id(page, "profile-retry").click();
        await expect(id(page, "profile-error")).toBeVisible();
    });

    test("§9: title, back chevron and field order Name, Age, Gender, Phone (+91), Email, Save", async ({page, mock}) => {
        await openProfile(page);
        await expect(id(page, "profile-title")).toHaveText(TEXT.title);
        await expect(id(page, "profile-back")).toBeVisible();
        const tops: number[] = [];
        for (const field of ["profile-name", "profile-age", "profile-gender-male", "profile-phone", "profile-email",
            "profile-save"]) {
            tops.push((await id(page, field).boundingBox())!.y);
        }
        expect([...tops].sort((a, b) => a - b)).toEqual(tops);
        await expect(id(page, "profile-screen")).toContainText("+91");
        await expect(id(page, "profile-phone")).not.toHaveValue(/\+91/);
        for (const field of FIELD_IDS) {
            await expect(id(page, field)).toBeVisible();
        }
        await expectGender(page, null);
    });

    test("§8: input caps: name maxlength 80, age digits only maxlength 3, phone digits only", async ({page, mock}) => {
        await openProfile(page);
        await expect(id(page, "profile-name")).toHaveAttribute("maxlength", "80");
        await id(page, "profile-name").fill("x".repeat(90));
        await expect(id(page, "profile-name")).toHaveValue("x".repeat(80));
        await expect(id(page, "profile-age")).toHaveAttribute("maxlength", "3");
        await id(page, "profile-age").click();
        await page.keyboard.type("2a9-1x7");
        await expect(id(page, "profile-age")).toHaveValue("291");
        await id(page, "profile-phone").click();
        await page.keyboard.type("98a76-54 32+10x99");
        const phone = (await id(page, "profile-phone").inputValue()).replace(/\s/g, "");
        expect(phone).toBe("9876543210");
    });
});

test.describe("RV4 Profile guards", () => {
    test("AC13: signed-out users opening /profile go to Login", async ({page, mock}) => {
        await open(page, "/profile");
        await expectOnScreen(page, "login", /\/login/);
        await expect(id(page, "profile-screen")).toHaveCount(0);
    });

    test("AC13: after Logout, /profile goes to Login", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        await id(page, "home-logout").click();
        await expectOnScreen(page, "login", /\/login/);
        await open(page, "/profile");
        await expectOnScreen(page, "login", /\/login/);
    });

    for (const scenario of UNAUTHORISED) {
        test(`AC6 / ruling 11: GET /profile ${scenario} → signed out to Login`, async ({page, mock}) => {
            await logIn(page);
            await expectOnScreen(page, "home");
            await mock.setScenario("profile.get", scenario);
            await open(page, "/profile");
            await expectOnScreen(page, "login", /\/login/);
            await expect(id(page, "profile-error")).toHaveCount(0);
            await open(page, "/home");
            await expectOnScreen(page, "login", /\/login/);
        });
    }
});
