// RV1 · Bug 4 regression (mock project): tapping a code box must focus the code input so the keyboard can type
// into it, on Verify email and Reset code (AC18/AC19). Web can't reproduce iOS hit-testing, so this pins the
// contract: a real pointer tap at a cell's position (not fill() on the hidden input) followed by keyboard typing
// fills all six cells. The native check is the owner's device re-check.
import {type Page} from "@playwright/test";

import {expect, expectOnScreen, id, MOCK_CODE, reach, test} from "./support/rv1";

async function tapCell(page: Page, module: "verify" | "forgot-code", index: number): Promise<void> {
    const box = await id(page, `${module}-code-cell-${index}`).boundingBox();
    expect(box, `${module}-code-cell-${index} should be on screen`).toBeTruthy();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

for (const module of ["verify", "forgot-code"] as const) {
    for (const size of [{width: 390, height: 844}, {width: 1280, height: 820}]) {
        test(`Bug 4 / AC18: tapping a ${module} code box opens typing (${size.width}×${size.height})`,
            async ({page, mock}) => {
                await page.setViewportSize(size);
                await reach(page, module);
                await tapCell(page, module, 0);
                await expect(id(page, `${module}-code-input`)).toBeFocused();
                await page.keyboard.type(MOCK_CODE);
                for (let i = 0; i < 6; i++) {
                    await expect(id(page, `${module}-code-cell-${i}`)).toContainText(MOCK_CODE[i]);
                }
                await id(page, `${module}-submit`).click();
                await expectOnScreen(page, module === "verify" ? "home" : "reset");
            });
    }

    test(`Bug 4 / AC18: tapping a middle ${module} code box after blurring refocuses the input`, async ({page, mock}) => {
        await page.setViewportSize({width: 390, height: 844});
        await reach(page, module);
        await tapCell(page, module, 0);
        await page.keyboard.type("12");
        await id(page, `${module}-code-input`).blur();
        await tapCell(page, module, 3);
        await expect(id(page, `${module}-code-input`)).toBeFocused();
        await page.keyboard.type("3456");
        await expect(id(page, `${module}-code-cell-5`)).toContainText("6");
    });
}
