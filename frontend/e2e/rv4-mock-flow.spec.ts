// RV4 · Full flow and every error code in mock mode (mock project): AC14.
import {
    EMAIL_INITIAL,
    expect,
    expectHomeInitial,
    expectOnScreen,
    expectProfile,
    GET_ERRORS,
    id,
    logIn,
    open,
    openProfile,
    saveProfile,
    test,
    TEXT,
    UNAUTHORISED,
    UPDATE_ERRORS,
} from "./support/rv4";

const FULL = {name: "Venu Gopal", age: "29", gender: "other" as const, phone: "9876543210"};

test.describe("RV4 Mock flow (AC14)", () => {
    test("AC14: login → Home → Profile → edit → Save → new initial → reload → values persist", async ({page, mock}) => {
        await logIn(page);
        await expectHomeInitial(page, EMAIL_INITIAL);
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile", /\/profile/);
        await expectProfile(page, {name: "", age: "", gender: null, phone: ""});
        await saveProfile(page, FULL);
        await expectHomeInitial(page, "V");
        await page.reload();
        await expectHomeInitial(page, "V");
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile");
        await expectProfile(page, FULL);
        await page.reload();
        await expectOnScreen(page, "profile", /\/profile/);
        await expectProfile(page, FULL);
    });

    test("AC14: __mock.reset() clears saved profiles", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, FULL);
        await expectHomeInitial(page, "V");
        await mock.reset();
        await page.evaluate(() => window.localStorage.clear());
        await logIn(page);
        await expectHomeInitial(page, EMAIL_INITIAL);
    });

    test("AC14: every profile.get scenario is registered", async ({page, mock}) => {
        for (const scenario of ["ok", ...GET_ERRORS]) {
            await mock.setScenario("profile.get", scenario);
        }
    });

    test("AC14: every profile.update scenario is registered", async ({page, mock}) => {
        for (const scenario of ["ok", ...UPDATE_ERRORS]) {
            await mock.setScenario("profile.update", scenario);
        }
    });

    for (const scenario of GET_ERRORS) {
        test(`AC14: profile.get ${scenario} reaches its screen state`, async ({page, mock}) => {
            await logIn(page);
            await expectOnScreen(page, "home");
            await mock.setScenario("profile.get", scenario);
            await open(page, "/profile");
            if (UNAUTHORISED.includes(scenario)) {
                await expectOnScreen(page, "login", /\/login/);
            } else {
                await expect(id(page, "profile-error")).toContainText(TEXT.loadError);
            }
        });
    }

    for (const scenario of UPDATE_ERRORS) {
        test(`AC14: profile.update ${scenario} reaches its screen state`, async ({page, mock}) => {
            await openProfile(page);
            await mock.setScenario("profile.update", scenario);
            await id(page, "profile-save").click();
            if (UNAUTHORISED.includes(scenario)) {
                await expectOnScreen(page, "login", /\/login/);
            } else if (scenario === "invalid_profile") {
                await expect(id(page, "profile-save-error")).toHaveText(TEXT.saveInvalid);
            } else {
                await expect(id(page, "profile-save-error")).toHaveText(TEXT.saveFailed);
            }
        });
    }
});
