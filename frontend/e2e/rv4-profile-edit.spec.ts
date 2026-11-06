// RV4 · Profile validation, gender, back and save (mock project): AC10, AC11, AC12, AC6 (401 on save, ruling 11).
import {
    EMAIL_INITIAL,
    expect,
    expectGender,
    expectHomeInitial,
    expectOnScreen,
    expectProfile,
    expectSaveDisabled,
    genderOption,
    id,
    openProfile,
    save,
    saveProfile,
    setText,
    test,
    TEXT,
    UNAUTHORISED,
} from "./support/rv4";

const FULL = {name: "Venu Gopal", age: "29", gender: "male" as const, phone: "9876543210"};

test.describe("RV4 Client validation (AC10)", () => {
    const CASES = [
        {field: "profile-name", error: "profile-name-error", value: "ab", text: TEXT.nameShort, good: "Abc"},
        {field: "profile-age", error: "profile-age-error", value: "17", text: TEXT.ageUnder, good: "18"},
        {field: "profile-age", error: "profile-age-error", value: "121", text: TEXT.ageInvalid, good: "120"},
        {field: "profile-age", error: "profile-age-error", value: "999", text: TEXT.ageInvalid, good: "45"},
        {field: "profile-age", error: "profile-age-error", value: "0", text: TEXT.ageUnder, good: "30"},
        {field: "profile-phone", error: "profile-phone-error", value: "98765", text: TEXT.phoneInvalid, good: "0123456789"},
    ];
    for (const c of CASES) {
        test(`AC10: ${c.field} "${c.value}" on blur → "${c.text}", Save disabled; fixing it clears both`, async ({page, mock}) => {
            await openProfile(page);
            await expect(id(page, c.error)).toHaveCount(0);
            await setText(id(page, c.field), c.value);
            await expect(id(page, c.error)).toHaveText(c.text);
            await expectSaveDisabled(page, true);
            await setText(id(page, c.field), c.good);
            await expect(id(page, c.error)).toHaveCount(0);
            await expectSaveDisabled(page, false);
        });
    }

    test("AC10: no error while typing, before the field loses focus", async ({page, mock}) => {
        await openProfile(page);
        await id(page, "profile-name").click();
        await id(page, "profile-name").fill("ab");
        await expect(id(page, "profile-name-error")).toHaveCount(0);
    });

    test("AC10: Save validates too: invalid untouched-blur input shows the message and stays", async ({page, mock}) => {
        await openProfile(page);
        await id(page, "profile-phone").click();
        await id(page, "profile-phone").fill("123");
        await id(page, "profile-save").click();
        await expect(id(page, "profile-phone-error")).toHaveText(TEXT.phoneInvalid);
        await expectOnScreen(page, "profile", /\/profile/);
    });

    test("AC10: several invalid fields show every message", async ({page, mock}) => {
        await openProfile(page);
        await setText(id(page, "profile-name"), "ab");
        await setText(id(page, "profile-age"), "12");
        await setText(id(page, "profile-phone"), "1");
        await expect(id(page, "profile-name-error")).toHaveText(TEXT.nameShort);
        await expect(id(page, "profile-age-error")).toHaveText(TEXT.ageUnder);
        await expect(id(page, "profile-phone-error")).toHaveText(TEXT.phoneInvalid);
        await expectSaveDisabled(page, true);
    });

    test("AC10: empty fields are always valid; clearing an invalid field clears its error", async ({page, mock}) => {
        await openProfile(page);
        for (const field of ["profile-name", "profile-age", "profile-phone"]) {
            await setText(id(page, field), "");
        }
        await expect(id(page, "profile-name-error")).toHaveCount(0);
        await expect(id(page, "profile-age-error")).toHaveCount(0);
        await expect(id(page, "profile-phone-error")).toHaveCount(0);
        await setText(id(page, "profile-name"), "ab");
        await expect(id(page, "profile-name-error")).toBeVisible();
        await setText(id(page, "profile-name"), "");
        await expect(id(page, "profile-name-error")).toHaveCount(0);
        await expectSaveDisabled(page, false);
    });

    test("AC10: edge values 3-char name, 18, 120 and a 10-digit phone are valid", async ({page, mock}) => {
        await openProfile(page);
        await setText(id(page, "profile-name"), "Abc");
        await setText(id(page, "profile-age"), "120");
        await setText(id(page, "profile-phone"), "1234567890");
        await expect(id(page, "profile-name-error")).toHaveCount(0);
        await expect(id(page, "profile-age-error")).toHaveCount(0);
        await expect(id(page, "profile-phone-error")).toHaveCount(0);
        await expectSaveDisabled(page, false);
    });
});

test.describe("RV4 Gender and Back (AC12)", () => {
    test("AC12: set, change and clear the gender (tap the selected option again)", async ({page, mock}) => {
        await openProfile(page);
        await expectGender(page, null);
        await genderOption(page, "male").click();
        await expectGender(page, "male");
        await genderOption(page, "female").click();
        await expectGender(page, "female");
        await genderOption(page, "other").click();
        await expectGender(page, "other");
        await genderOption(page, "other").click();
        await expectGender(page, null);
    });

    test("AC12: a cleared gender is saved as cleared", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, {gender: "female"});
        await id(page, "home-profile").click();
        await expectGender(page, "female");
        await genderOption(page, "female").click();
        await save(page);
        await expectOnScreen(page, "home", /\/home/);
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expectGender(page, null);
    });

    test("AC12: Back returns to Home without saving (changes discarded, no dialog)", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, FULL);
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await setText(id(page, "profile-name"), "Someone Else");
        await setText(id(page, "profile-age"), "40");
        await genderOption(page, "other").click();
        page.on("dialog", (dialog) => {
            throw new Error(`unexpected dialog: ${dialog.message()}`);
        });
        await id(page, "profile-back").click();
        await expectHomeInitial(page, "V");
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expectProfile(page, FULL);
    });
});

test.describe("RV4 Save (AC11)", () => {
    test("AC11: Save → Home with the new initial; values persist", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, FULL);
        await expectHomeInitial(page, "V");
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expectProfile(page, FULL);
    });

    test("AC11: phone is saved as 10 digits (no spaces, no +91)", async ({page, mock}) => {
        await openProfile(page);
        await id(page, "profile-phone").click();
        await page.keyboard.type("98765 43210");
        await id(page, "profile-phone").blur();
        await save(page);
        await expectOnScreen(page, "home", /\/home/);
        const stored = await page.evaluate(() => JSON.stringify(window.localStorage));
        expect(stored).toContain("9876543210");
        expect(stored).not.toMatch(/\+919876543210|98765 43210/);
    });

    test("AC11: saving state: Save busy, inputs locked", async ({page, mock}) => {
        await openProfile(page);
        await mock.setLatency(4000);
        await setText(id(page, "profile-name"), "Venu Gopal");
        await id(page, "profile-save").click();
        await expect(id(page, "profile-save")).toHaveAttribute("aria-busy", "true");
        for (const field of ["profile-name", "profile-age", "profile-phone"]) {
            await expect(id(page, field)).toHaveAttribute("readonly", /.*/);
        }
        for (const gender of ["male", "female", "other"] as const) {
            await expect(genderOption(page, gender)).toHaveAttribute("aria-disabled", "true");
        }
        await expectHomeInitial(page, "V");
    });

    test("AC11: forced invalid_profile highlights name and phone with the friendly message", async ({page, mock}) => {
        await openProfile(page);
        await setText(id(page, "profile-name"), "Venu Gopal");
        await setText(id(page, "profile-phone"), "9876543210");
        await mock.setScenario("profile.update", "invalid_profile");
        await save(page);
        await expect(id(page, "profile-save-error")).toHaveText(TEXT.saveInvalid);
        await expect(id(page, "profile-name-error")).toBeVisible();
        await expect(id(page, "profile-phone-error")).toBeVisible();
        await expect(id(page, "profile-age-error")).toHaveCount(0);
        await expectOnScreen(page, "profile", /\/profile/);
        await expect(id(page, "profile-name")).toHaveValue("Venu Gopal");
    });

    for (const scenario of ["internal_error", "network_error", "invalid_request"]) {
        test(`AC11: ${scenario} → "Couldn't save. Try again." and input kept`, async ({page, mock}) => {
            await openProfile(page);
            await fillAll(page);
            await mock.setScenario("profile.update", scenario);
            await save(page);
            await expect(id(page, "profile-save-error")).toHaveText(TEXT.saveFailed);
            await expectOnScreen(page, "profile", /\/profile/);
            await expectProfile(page, FULL);
            await expect(id(page, "profile-save")).not.toHaveAttribute("aria-busy", "true");
            // The error clears on a successful retry.
            await mock.setScenario("profile.update", "ok");
            await save(page);
            await expectHomeInitial(page, "V");
        });
    }

    for (const scenario of UNAUTHORISED) {
        test(`AC6 / ruling 11: PUT /profile ${scenario} → signed out to Login`, async ({page, mock}) => {
            await openProfile(page);
            await fillAll(page);
            await mock.setScenario("profile.update", scenario);
            await save(page);
            await expectOnScreen(page, "login", /\/login/);
        });
    }

    test("AC11: clearing every field and saving shows the email initial again", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, FULL);
        await expectHomeInitial(page, "V");
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await setText(id(page, "profile-name"), "");
        await setText(id(page, "profile-age"), "");
        await setText(id(page, "profile-phone"), "");
        await genderOption(page, "male").click();
        await save(page);
        await expectHomeInitial(page, EMAIL_INITIAL);
        await id(page, "home-profile").click();
        await expectProfile(page, {name: "", age: "", gender: null, phone: ""});
    });
});

async function fillAll(page: import("@playwright/test").Page): Promise<void> {
    await setText(id(page, "profile-name"), FULL.name);
    await setText(id(page, "profile-age"), FULL.age);
    await setText(id(page, "profile-phone"), FULL.phone);
    await genderOption(page, FULL.gender).click();
    await expectGender(page, FULL.gender);
}
