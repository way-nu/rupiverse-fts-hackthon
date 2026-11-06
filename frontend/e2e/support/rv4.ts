// Shared helpers and the UI contract for the RV4 Playwright specs (Tester-owned).
// Contract: Spec §8 "testIDs (final)" + §9 (builder "contract final", PM rulings Q9–Q11, 2026-11-06).
import {expect, type Locator, type Page} from "@playwright/test";

import {expectOnScreen, id, logIn, open, VERIFIED} from "./rv1";

export {expect, expectOnScreen, id, logIn, open, VERIFIED};
export {test} from "./rv1";

// The mock demo user starts with no saved profile, so its tile shows the email's initial.
export const EMAIL_INITIAL = VERIFIED.email[0].toUpperCase();

export const TEXT = {
    title: "Profile",
    loadError: "Couldn't load your profile.",
    nameShort: "Name must be at least 3 characters",
    ageUnder: "You must be 18 or older",
    ageInvalid: "Enter a valid age",
    phoneInvalid: "Enter a valid 10-digit number",
    saveInvalid: "Some details aren't valid. Check the highlighted fields.",
    saveFailed: "Couldn't save. Try again.",
};

// §8: scenario keys and every code each one can force (plus ok / network_error from mockControl).
export const GET_ERRORS = ["not_authenticated", "token_expired", "invalid_token", "internal_error", "network_error"];
export const UPDATE_ERRORS = [...GET_ERRORS, "invalid_profile", "invalid_request"];
export const UNAUTHORISED = ["not_authenticated", "token_expired", "invalid_token"];

export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export type ProfileInput = { name?: string; age?: string; gender?: Gender | null; phone?: string };

export const SIZES = [
    {width: 360, height: 740},
    {width: 393, height: 852},
    {width: 430, height: 932},
    {width: 768, height: 1024},
    {width: 1180, height: 820},
    {width: 1440, height: 900},
];

export const FIELD_IDS = ["profile-name", "profile-age", "profile-gender-male", "profile-gender-female",
    "profile-gender-other", "profile-phone", "profile-email", "profile-save"];

export const digits = (value: string): string => value.replace(/\D/g, "");

export async function homeInitial(page: Page): Promise<string> {
    return ((await id(page, "home-profile").textContent()) ?? "").trim();
}

export async function expectHomeInitial(page: Page, letter: string): Promise<void> {
    await expectOnScreen(page, "home", /\/home/);
    await expect(id(page, "home-profile")).toHaveText(letter);
}

// Login → Home → Profile, waiting for the loaded form.
export async function openProfile(page: Page): Promise<void> {
    await logIn(page);
    await expectOnScreen(page, "home", /\/home/);
    await id(page, "home-profile").click();
    await expectOnScreen(page, "profile", /\/profile/);
}

export async function setText(field: Locator, value: string): Promise<void> {
    await field.click();
    await field.fill(value);
    await field.blur();
}

export async function fillProfile(page: Page, input: ProfileInput): Promise<void> {
    if (input.name !== undefined) await setText(id(page, "profile-name"), input.name);
    if (input.age !== undefined) await setText(id(page, "profile-age"), input.age);
    if (input.phone !== undefined) await setText(id(page, "profile-phone"), input.phone);
    if (input.gender !== undefined) await setGender(page, input.gender);
}

export const genderOption = (page: Page, gender: Gender): Locator => id(page, `profile-gender-${gender}`);

export async function selectedGender(page: Page): Promise<Gender | null> {
    for (const gender of GENDERS) {
        if ((await genderOption(page, gender).getAttribute("aria-checked")) === "true") return gender;
    }
    return null;
}

export async function setGender(page: Page, gender: Gender | null): Promise<void> {
    const current = await selectedGender(page);
    if (gender === current) return;
    if (gender === null) {
        await genderOption(page, current!).click();
    } else {
        await genderOption(page, gender).click();
    }
    await expect.poll(() => selectedGender(page)).toBe(gender);
}

export async function expectGender(page: Page, gender: Gender | null): Promise<void> {
    for (const option of GENDERS) {
        await expect(genderOption(page, option)).toHaveAttribute("role", "radio");
        await expect(genderOption(page, option)).toHaveAttribute("aria-checked", option === gender ? "true" : "false");
    }
}

export async function expectProfile(page: Page, input: Required<ProfileInput>): Promise<void> {
    await expect(id(page, "profile-name")).toHaveValue(input.name);
    await expect(id(page, "profile-age")).toHaveValue(input.age);
    await expect.poll(async () => digits(await id(page, "profile-phone").inputValue())).toBe(digits(input.phone));
    await expectGender(page, input.gender);
    await expect(id(page, "profile-email")).toHaveValue(VERIFIED.email);
}

export async function save(page: Page): Promise<void> {
    await expect(id(page, "profile-save")).not.toHaveAttribute("aria-disabled", "true");
    await id(page, "profile-save").click();
}

// Fill, save and land back on Home.
export async function saveProfile(page: Page, input: ProfileInput): Promise<void> {
    await fillProfile(page, input);
    await save(page);
    await expectOnScreen(page, "home", /\/home/);
}

export async function expectSaveDisabled(page: Page, disabled: boolean): Promise<void> {
    if (disabled) {
        await expect(id(page, "profile-save")).toHaveAttribute("aria-disabled", "true");
    } else {
        await expect(id(page, "profile-save")).not.toHaveAttribute("aria-disabled", "true");
    }
}

export async function noHorizontalOverflow(page: Page, width: number): Promise<void> {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, "no horizontal scrolling").toBeLessThanOrEqual(width);
}

// The element is fully inside the viewport horizontally and not clipped by an ancestor.
export async function expectNotClipped(locator: Locator, width: number): Promise<void> {
    const box = await locator.boundingBox();
    expect(box, "element is rendered").toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
    const clipped = await locator.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        for (let node = el.parentElement; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.overflowX === "visible" && style.overflowY === "visible") continue;
            const outer = node.getBoundingClientRect();
            if (rect.left < outer.left - 0.5 || rect.right > outer.right + 0.5) return true;
        }
        return false;
    });
    expect(clipped, "element is not clipped by an ancestor").toBe(false);
}
