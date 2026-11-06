// RV4 · Home profile button (mock project): AC8, plus the §9 loading / failure rules for the tile.
import {
    EMAIL_INITIAL,
    expect,
    expectHomeInitial,
    expectOnScreen,
    id,
    logIn,
    openProfile,
    saveProfile,
    test,
} from "./support/rv4";

test.describe("RV4 Home profile button", () => {
    test("AC8: no saved name → the email's initial, upper case", async ({page, mock}) => {
        await logIn(page);
        await expectHomeInitial(page, EMAIL_INITIAL);
        await expect(id(page, "home-profile")).toHaveText(/^[A-Z]$/);
    });

    test("AC8: tapping the button opens /profile", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home", /\/home/);
        await id(page, "home-profile").click();
        await expectOnScreen(page, "profile", /\/profile/);
    });

    const NAMES: { name: string; initial: string; why: string }[] = [
        {name: "venu Gopal", initial: "V", why: "lower-case name is upper-cased"},
        {name: "Asha", initial: "A", why: "the name's first letter"},
        {name: "élodie", initial: "É", why: "accented letter is upper-cased"},
        {name: "वेणु", initial: "व", why: "letter in another script"},
        {name: "9 Lives", initial: EMAIL_INITIAL, why: "a digit falls back to the email's initial"},
        {name: "#Hashtag", initial: EMAIL_INITIAL, why: "a symbol falls back to the email's initial"},
        {name: "😀 Smiley", initial: EMAIL_INITIAL, why: "an emoji falls back to the email's initial"},
    ];
    for (const {name, initial, why} of NAMES) {
        test(`AC8: name "${name}" → "${initial}" (${why})`, async ({page, mock}) => {
            await openProfile(page);
            await saveProfile(page, {name});
            await expectHomeInitial(page, initial);
        });
    }

    test("AC8: the tile is the design's avatar: 32×32, radius 8, accent background, 13/700", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        const tile = id(page, "home-profile");
        const box = await tile.boundingBox();
        expect(box).toBeTruthy();
        expect(Math.round(box!.width)).toBe(32);
        expect(Math.round(box!.height)).toBe(32);
        const style = await tile.evaluate((el) => {
            const own = getComputedStyle(el);
            const text = el.querySelector("div,span") ?? el;
            const inner = getComputedStyle(text);
            return {
                radius: own.borderTopLeftRadius,
                bg: own.backgroundColor,
                size: inner.fontSize,
                weight: inner.fontWeight,
            };
        });
        expect(style.radius).toBe("8px");
        expect(style.bg).toBe("rgb(31, 90, 80)");
        expect(style.size).toBe("13px");
        expect(style.weight).toBe("700");
    });

    test("AC8 / §9: the tile sits at the top right of Home", async ({page, mock}) => {
        await logIn(page);
        await expectOnScreen(page, "home");
        const viewport = page.viewportSize()!;
        const box = (await id(page, "home-profile").boundingBox())!;
        expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.75);
        expect(box.y).toBeLessThan(120);
    });

    test("§9: while the profile loads the tile shows the email's initial", async ({page, mock}) => {
        await openProfile(page);
        await saveProfile(page, {name: "Venu"});
        await expectHomeInitial(page, "V");
        await mock.setLatency(4000);
        await page.reload();
        await expect(id(page, "home-profile")).toHaveText(EMAIL_INITIAL);
        await expect(id(page, "home-profile")).toHaveText("V", {timeout: 15_000});
    });

    for (const scenario of ["internal_error", "network_error"]) {
        test(`§9: profile load fails (${scenario}) → email initial, button still opens /profile`, async ({page, mock}) => {
            await openProfile(page);
            await saveProfile(page, {name: "Venu"});
            await mock.setScenario("profile.get", scenario);
            await page.reload();
            await expectHomeInitial(page, EMAIL_INITIAL);
            await id(page, "home-profile").click();
            await expect(page).toHaveURL(/\/profile/);
            await expect(id(page, "profile-error")).toBeVisible();
        });
    }
});
