// RV1 · Responsive layout and theme (mock project): AC19, AC20, plus spot checks at the frontend/CLAUDE.md sizes.
import {AUTH_SCREENS, backgroundOf, expect, fill, id, logIn, open, reach, test, TEXT, THEME} from "./support/rv1";

const DESKTOP = [{width: 1280, height: 820}, {width: 1440, height: 900}, {width: 1180, height: 820}];
const MOBILE = [{width: 390, height: 844}, {width: 360, height: 740}, {width: 393, height: 852},
    {width: 430, height: 932}, {width: 768, height: 1024}];

test.describe("RV1 Layout (AC19)", () => {
    for (const size of DESKTOP) {
        for (const screen of AUTH_SCREENS) {
            test(`AC19: ${screen.module} uses the desktop split at ${size.width}×${size.height}`, async ({page, mock}) => {
                await page.setViewportSize(size);
                await reach(page, screen.module);
                await expect(id(page, "auth-layout-desktop")).toBeVisible();
                await expect(id(page, "auth-layout-mobile")).toHaveCount(0);
                await expect(id(page, "auth-brand")).toContainText(TEXT.tagline);
                await expect(id(page, "auth-brand")).toContainText("India · 2026");
                const brand = await id(page, "auth-brand").boundingBox();
                const form = await id(page, `${screen.module}-screen`).boundingBox();
                expect(brand && form).toBeTruthy();
                expect(brand!.x).toBeLessThan(form!.x);
                expect(Math.abs(brand!.width - size.width / 2)).toBeLessThan(size.width * 0.05);
                expect(form!.width).toBeLessThanOrEqual(381);
                if (screen.hasBack) {
                    await expect(id(page, "auth-back")).toContainText("Back");
                } else {
                    await expect(id(page, "auth-back")).toHaveCount(0);
                }
            });
        }
    }

    for (const size of MOBILE) {
        for (const screen of AUTH_SCREENS) {
            test(`AC19: ${screen.module} uses the mobile layout at ${size.width}×${size.height}`, async ({page, mock}) => {
                await page.setViewportSize(size);
                await reach(page, screen.module);
                await expect(id(page, "auth-layout-mobile")).toBeVisible();
                await expect(id(page, "auth-layout-desktop")).toHaveCount(0);
                await expect(id(page, "auth-brand")).toHaveCount(0);
                await expect(id(page, "auth-logo")).toBeVisible();
                await expect(id(page, screen.hasBack ? "auth-back" : "auth-logo")).toBeVisible();
                if (!screen.hasBack) {
                    await expect(id(page, "auth-back")).toHaveCount(0);
                }
                const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
                expect(scrollWidth, "no horizontal scrolling").toBeLessThanOrEqual(size.width);
            });
        }
    }

    test("AC19: resizing across 1024 px switches layouts live and keeps typed input", async ({page, mock}) => {
        await page.setViewportSize({width: 1280, height: 820});
        await open(page, "/login");
        await fill(page, "login-email", "keep@rupiverse.app");
        await expect(id(page, "auth-layout-desktop")).toBeVisible();
        await page.setViewportSize({width: 1023, height: 820});
        await expect(id(page, "auth-layout-mobile")).toBeVisible();
        await expect(id(page, "auth-layout-desktop")).toHaveCount(0);
        await page.setViewportSize({width: 1024, height: 820});
        await expect(id(page, "auth-layout-desktop")).toBeVisible();
        await expect(id(page, "login-email")).toHaveValue("keep@rupiverse.app");
    });

    test("AC19: fonts and buttons keep fixed sizes across widths (only containers respond)", async ({page, mock}) => {
        const measure = async () => id(page, "login-submit").evaluate((el) => ({
            height: el.getBoundingClientRect().height,
            font: getComputedStyle(el.querySelector("div,span") ?? el).fontSize,
        }));
        await page.setViewportSize({width: 360, height: 740});
        await open(page, "/login");
        const small = await measure();
        await page.setViewportSize({width: 768, height: 1024});
        const medium = await measure();
        expect(medium).toEqual(small);
    });
});

test.describe("RV1 Theme (AC20)", () => {
    for (const scheme of ["light", "dark"] as const) {
        for (const screen of ["login", "signup"] as const) {
            test(`AC20: ${screen} uses ${scheme === "light" ? "Calm" : "Midnight"} in ${scheme} mode`, async ({page, mock}) => {
                await page.emulateMedia({colorScheme: scheme});
                await open(page, `/${screen}`);
                await expect(id(page, `${screen}-screen`)).toBeVisible();
                expect(await backgroundOf(id(page, `${screen}-screen`))).toBe(THEME[scheme].page);
                if (screen === "login") {
                    await fill(page, "login-email", "demo@rupiverse.app");
                    await fill(page, "login-password", "Demo@1234");
                    expect(await backgroundOf(id(page, "login-submit"))).toBe(THEME[scheme].accent);
                    const ink = await id(page, "login-title").evaluate((el) => getComputedStyle(el).color);
                    expect(ink).toBe(THEME[scheme].ink);
                }
            });
        }
    }

    test("AC20: the desktop brand panel is the accent colour in both themes", async ({page, mock}) => {
        for (const scheme of ["light", "dark"] as const) {
            await page.emulateMedia({colorScheme: scheme});
            await open(page, "/login");
            expect(await backgroundOf(id(page, "auth-brand"))).toBe(THEME[scheme].accent);
        }
    });

    test("AC20: switching the OS setting updates the theme live, without a reload", async ({page, mock}) => {
        await page.emulateMedia({colorScheme: "light"});
        await open(page, "/login");
        await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
        expect(await backgroundOf(id(page, "login-screen"))).toBe(THEME.light.page);
        await page.emulateMedia({colorScheme: "dark"});
        await expect.poll(() => backgroundOf(id(page, "login-screen"))).toBe(THEME.dark.page);
        await page.emulateMedia({colorScheme: "light"});
        await expect.poll(() => backgroundOf(id(page, "login-screen"))).toBe(THEME.light.page);
        expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    });

    test("AC20: Home placeholder follows the theme", async ({page, mock}) => {
        await page.emulateMedia({colorScheme: "dark"});
        await logIn(page);
        await expect(id(page, "home-screen")).toBeVisible();
        expect(await backgroundOf(id(page, "home-screen"))).toBe(THEME.dark.page);
    });

    test("AC20: Geist is the font in both themes", async ({page, mock}) => {
        await open(page, "/login");
        const family = await id(page, "login-title").evaluate((el) => getComputedStyle(el).fontFamily);
        expect(family).toMatch(/Geist/i);
    });

    test("AC20: text is readable in both themes (title contrast ≥ 4.5:1)", async ({page, mock}) => {
        for (const scheme of ["light", "dark"] as const) {
            await page.emulateMedia({colorScheme: scheme});
            await open(page, "/login");
            const fg = await id(page, "login-title").evaluate((el) => getComputedStyle(el).color);
            const bg = await backgroundOf(id(page, "login-title"));
            expect(contrast(fg, bg), `${scheme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
    });
});

function contrast(a: string, b: string): number {
    const lum = (rgb: string) => {
        const [r, g, bl] = (rgb.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number).map((c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
