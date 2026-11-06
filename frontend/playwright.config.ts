// Playwright for RV1+ (Tester-owned). Two projects, per frontend/CLAUDE.md:
//   mock: Expo web with EXPO_PUBLIC_API_MODE=mock, no backend. Every screen state and error code.
//   live: Expo web against the real backend (test outbox on). End-to-end acceptance flows only.
// testMatch is matched against the full path, so the patterns anchor on the file name: a checkout folder like
// "rv1-master" must not pull live specs into the mock project.
// Only one Expo web server runs on WEB_PORT at a time, so the webServer list follows the project being run:
//   npx playwright test --project=mock
//   npx playwright test --project=live
import {defineConfig, devices} from "@playwright/test";

const WEB_PORT = Number(process.env.WEB_PORT ?? 8082);
const API_PORT = Number(process.env.API_PORT ?? 8002);
const WEB_URL = `http://localhost:${WEB_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;

const argv = process.argv.join(" ");
const isLive = /--project[= ]live\b/.test(argv) || process.env.E2E_PROJECT === "live";
const reuse = process.env.PW_REUSE_SERVER === "1";

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    expect: {timeout: 10_000},
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"], ["html", {open: "never"}]],
    use: {
        baseURL: WEB_URL,
        viewport: {width: 1280, height: 820},
        colorScheme: "light",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "mock",
            testMatch: /(?:^|[\\/])rv\d+-(?!live-)[^\\/]*\.spec\.ts$/,
            use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 820}},
        },
        {
            name: "live",
            testMatch: /(?:^|[\\/])rv\d+-live-[^\\/]*\.spec\.ts$/,
            use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 820}},
        },
    ],
    webServer: isLive
        ? [
            {
                command: `uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
                cwd: "../backend",
                url: `${API_URL}/openapi.json`,
                env: {
                    APP_ENV: "test",
                    TEST_OUTBOX_ENABLED: "true",
                    CORS_ORIGINS: WEB_URL,
                },
                reuseExistingServer: reuse,
                timeout: 120_000,
            },
            {
                command: `npx expo start --web --port ${WEB_PORT}`,
                url: WEB_URL,
                env: {EXPO_PUBLIC_API_MODE: "live", EXPO_PUBLIC_API_URL: API_URL},
                reuseExistingServer: reuse,
                timeout: 180_000,
            },
        ]
        : [
            {
                command: `npx expo start --web --port ${WEB_PORT}`,
                url: WEB_URL,
                env: {EXPO_PUBLIC_API_MODE: "mock", EXPO_PUBLIC_API_URL: API_URL},
                reuseExistingServer: reuse,
                timeout: 180_000,
            },
        ],
});

export {API_URL, WEB_URL};
