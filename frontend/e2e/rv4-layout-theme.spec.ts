// RV4 · Profile and Home at every size in Calm and Midnight (mock project): AC15.
import {backgroundOf, THEME} from "./support/rv1";
import {
    expect,
    expectNotClipped,
    expectOnScreen,
    FIELD_IDS,
    id,
    noHorizontalOverflow,
    openProfile,
    setText,
    SIZES,
    test,
} from "./support/rv4";

const ERROR_IDS = ["profile-name-error", "profile-age-error", "profile-phone-error"];

for (const scheme of ["light", "dark"] as const) {
    const theme = scheme === "light" ? "Calm" : "Midnight";
    const colours = THEME[scheme];

    test.describe(`RV4 ${theme} (AC15)`, () => {
        test.use({colorScheme: scheme});

        for (const size of SIZES) {
            const label = `${size.width}×${size.height}`;

            test(`AC15: Home profile button in ${theme} at ${label}`, async ({page, mock}, info) => {
                await page.setViewportSize(size);
                await openProfile(page);
                await id(page, "profile-back").click();
                await expectOnScreen(page, "home", /\/home/);
                const tile = id(page, "home-profile");
                await expectNotClipped(tile, size.width);
                expect(await backgroundOf(tile)).toBe(colours.accent);
                await noHorizontalOverflow(page, size.width);
                await info.attach(`home-${scheme}-${label}`, {body: await page.screenshot(), contentType: "image/png"});
            });

            test(`AC15: Profile form in ${theme} at ${label}`, async ({page, mock}, info) => {
                await page.setViewportSize(size);
                await openProfile(page);
                expect(await backgroundOf(id(page, "profile-screen"))).toBe(colours.page);
                for (const field of FIELD_IDS) {
                    await id(page, field).scrollIntoViewIfNeeded();
                    await expectNotClipped(id(page, field), size.width);
                }
                const screen = (await id(page, "profile-name").boundingBox())!;
                const centre = screen.x + screen.width / 2;
                expect(Math.abs(centre - size.width / 2), "single column, centred").toBeLessThan(size.width * 0.05 + 1);
                await noHorizontalOverflow(page, size.width);
                await info.attach(`profile-${scheme}-${label}`, {body: await page.screenshot({fullPage: true}),
                    contentType: "image/png"});
            });

            test(`AC15: Profile invalid state in ${theme} at ${label}`, async ({page, mock}, info) => {
                await page.setViewportSize(size);
                await openProfile(page);
                await setText(id(page, "profile-name"), "ab");
                await setText(id(page, "profile-age"), "12");
                await setText(id(page, "profile-phone"), "123");
                for (const error of ERROR_IDS) {
                    await id(page, error).scrollIntoViewIfNeeded();
                    await expectNotClipped(id(page, error), size.width);
                }
                await noHorizontalOverflow(page, size.width);
                await info.attach(`profile-invalid-${scheme}-${label}`, {body: await page.screenshot({fullPage: true}),
                    contentType: "image/png"});
            });
        }
    });
}
