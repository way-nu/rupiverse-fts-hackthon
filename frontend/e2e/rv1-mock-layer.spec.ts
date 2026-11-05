/// <reference types="node" />
// RV1 · Mock layer (mock project): AC27 (mock mode end to end, scenarios, latency, reset), AC28 (contract + isolation,
// static checks on the source tree).
import fs from "node:fs";
import path from "node:path";

import {
    enterCode,
    expect,
    expectOnScreen,
    fill,
    id,
    logIn,
    MOCK_CODE,
    NEW_PASSWORD,
    open,
    SCENARIOS,
    signUp,
    STRONG_PASSWORD,
    test,
    TEXT,
    uniqueEmail,
} from "./support/rv1";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

test.describe("RV1 Mock mode end to end (AC27)", () => {
    test("AC27: signup → verify 123456 → Home → logout → login → Home, with no backend requests", async ({page, mock}) => {
        const apiCalls: string[] = [];
        page.on("request", (request) => {
            if (/:8002\b/.test(request.url())) {
                apiCalls.push(request.url());
            }
        });
        const email = uniqueEmail("mockflow");
        await signUp(page, email);
        await expectOnScreen(page, "verify", /\/verify/);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home", /\/home/);
        await expect(id(page, "home-email")).toContainText(email);
        await id(page, "home-logout").click();
        await expectOnScreen(page, "login", /\/login/);
        await logIn(page, email, STRONG_PASSWORD);
        await expectOnScreen(page, "home", /\/home/);
        expect(apiCalls, "mock mode must not call the backend").toEqual([]);
    });

    test("AC27: forgot → reset code 123456 → new password → login with the new password", async ({page, mock}) => {
        const email = uniqueEmail("mockreset");
        await signUp(page, email);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home");
        await id(page, "home-logout").click();

        await open(page, "/login");
        await id(page, "login-forgot").click();
        await fill(page, "forgot-email", email);
        await id(page, "forgot-submit").click();
        await enterCode(page, "forgot-code", MOCK_CODE);
        await id(page, "forgot-code-submit").click();
        await fill(page, "reset-password", NEW_PASSWORD);
        await fill(page, "reset-confirm", NEW_PASSWORD);
        await id(page, "reset-submit").click();
        await expect(id(page, "login-banner")).toContainText(TEXT.resetBanner);

        await logIn(page, email, STRONG_PASSWORD);
        await expect(id(page, "login-error")).toBeVisible();
        await logIn(page, email, NEW_PASSWORD);
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC27: mock state is stateful: a verified signup makes the same email taken", async ({page, mock}) => {
        const email = uniqueEmail("state");
        await signUp(page, email);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home");
        await id(page, "home-logout").click();
        await signUp(page, email);
        await expect(id(page, "signup-error")).toBeVisible();
    });

    test("AC27: mock db persists across a reload on web", async ({page, mock}) => {
        const email = uniqueEmail("persist");
        await signUp(page, email);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home");
        await id(page, "home-logout").click();
        await page.reload();
        await logIn(page, email, STRONG_PASSWORD);
        await expectOnScreen(page, "home", /\/home/);
    });

    test("AC27: __mock.reset() wipes users created in the session", async ({page, mock}) => {
        const email = uniqueEmail("reset");
        await signUp(page, email);
        await enterCode(page, "verify", MOCK_CODE);
        await id(page, "verify-submit").click();
        await expectOnScreen(page, "home");
        await id(page, "home-logout").click();
        await mock.reset();
        await logIn(page, email, STRONG_PASSWORD);
        await expect(id(page, "login-error")).toBeVisible();
    });

    test("AC27: setLatency controls how long calls take (default ~300 ms)", async ({page, mock}) => {
        await open(page, "/login");
        await fill(page, "login-email", "demo@rupiverse.app");
        await fill(page, "login-password", "Demo@1234");
        await mock.setLatency(2500);
        const started = Date.now();
        await id(page, "login-submit").click();
        await expectOnScreen(page, "home", /\/home/);
        expect(Date.now() - started).toBeGreaterThanOrEqual(2400);
    });

    test("AC27: window.__mock exposes setScenario, setLatency and reset", async ({page, mock}) => {
        const api = await page.evaluate(() => {
            const m = (window as unknown as { __mock: Record<string, unknown> }).__mock;
            return ["setScenario", "setLatency", "reset"].map((k) => typeof m[k]);
        });
        expect(api).toEqual(["function", "function", "function"]);
    });

    test("AC27: a scenario exists for every endpoint and every §8 error code", async ({page, mock}) => {
        const failures = await page.evaluate((all) => {
            const m = (window as unknown as { __mock: { setScenario(k: string, s: string): void } }).__mock;
            const bad: string[] = [];
            for (const [key, codes] of Object.entries(all)) {
                for (const code of [...codes, "ok"]) {
                    try {
                        m.setScenario(key, code);
                    } catch (error) {
                        bad.push(`${key}:${code} (${String(error)})`);
                    }
                }
            }
            return bad;
        }, SCENARIOS);
        expect(failures).toEqual([]);
    });

    test("AC27: setScenario rejects an unknown scenario (so typos can't silently pass)", async ({page, mock}) => {
        const threw = await page.evaluate(() => {
            const m = (window as unknown as { __mock: { setScenario(k: string, s: string): void } }).__mock;
            try {
                m.setScenario("auth.login", "definitely_not_a_code");
                return false;
            } catch {
                return true;
            }
        });
        expect(threw).toBe(true);
    });
});

test.describe("RV1 Mock contract and isolation (AC28, static)", () => {
    test("AC28: services/auth has types, api, mock and fixtures; api.gen.ts is generated", async () => {
        for (const file of ["services/index.ts", "services/http.ts", "services/api-error.ts", "services/auth-storage.ts",
            "services/auth-storage.web.ts", "services/mock/db.ts", "services/mock/control.ts", "services/auth/types.ts",
            "services/auth/api.ts", "services/auth/mock.ts", "services/auth/fixtures.ts", "types/api.gen.ts"]) {
            expect(fs.existsSync(path.join(SRC, file)), `src/${file} must exist`).toBe(true);
        }
        const types = fs.readFileSync(path.join(SRC, "services/auth/types.ts"), "utf8");
        expect(types).toMatch(/from\s+["']@\/types\/api\.gen["']/);
        expect(types).toMatch(/interface\s+AuthApi\b/);
        for (const file of ["api.ts", "mock.ts"]) {
            const text = fs.readFileSync(path.join(SRC, "services/auth", file), "utf8");
            expect(text, `${file} must be typed as AuthApi`).toMatch(/:\s*AuthApi\b|satisfies\s+AuthApi\b|implements\s+AuthApi\b/);
        }
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
        expect(pkg.scripts?.["gen:api"], "npm run gen:api must exist").toBeTruthy();
        expect(pkg.scripts?.test, "npm test must exist").toBeTruthy();
    });

    test("AC28: hooks and screens import the API only from @/services", async () => {
        const offenders = walk(path.join(SRC, "modules"))
            .filter((f) => /\.(ts|tsx)$/.test(f))
            .flatMap((f) => {
                const text = fs.readFileSync(f, "utf8");
                const bad = text.match(/from\s+["'](@\/services\/(auth\/(api|mock|fixtures)|http|mock\/[^"']+)|[^"']*\/services\/[^"']+)["']/g);
                return bad ? [`${path.relative(ROOT, f)}: ${bad.join(", ")}`] : [];
            });
        expect(offenders).toEqual([]);
    });

    test("AC28: only services/http.ts calls fetch; only auth-storage touches tokens", async () => {
        const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("api.gen.ts"));
        const fetchers = files.filter((f) => /\bfetch\(/.test(fs.readFileSync(f, "utf8")))
            .map((f) => path.relative(SRC, f));
        expect(fetchers.filter((f) => f !== path.join("services", "http.ts"))).toEqual([]);
        const storage = files.filter((f) => /localStorage|SecureStore/.test(fs.readFileSync(f, "utf8")))
            .map((f) => path.relative(SRC, f))
            .filter((f) => !/^services[/\\](auth-storage(\.web)?\.ts|mock[/\\])/.test(f));
        expect(storage, "token storage outside auth-storage").toEqual([]);
    });

    test("AC28: src/app holds only thin route files", async () => {
        const routes = walk(path.join(SRC, "app")).filter((f) => /\.(ts|tsx)$/.test(f));
        expect(routes.length).toBeGreaterThan(0);
        const fat = routes.filter((f) => {
            const code = fs.readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "").trim();
            return !/^export\s*\{\s*default\s*\}\s*from\s*["']@\/modules\/[\w/-]+["'];?$/.test(code);
        }).map((f) => path.relative(ROOT, f));
        expect(fat, "route files must only re-export from @/modules").toEqual([]);
    });

    test("AC28 / §9: routes exist for every RV1 screen", async () => {
        for (const route of ["(auth)/login", "(auth)/signup", "(auth)/verify", "(auth)/forgot", "(auth)/forgot-code",
            "(auth)/reset", "(app)/home"]) {
            expect(fs.existsSync(path.join(SRC, "app", `${route}.tsx`)), `src/app/${route}.tsx`).toBe(true);
        }
    });

    test("AC20: app.json follows the device colour scheme", async () => {
        const app = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8"));
        expect(app.expo.userInterfaceStyle).toBe("automatic");
    });
});
