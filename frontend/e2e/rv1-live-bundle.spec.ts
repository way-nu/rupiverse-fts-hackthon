/// <reference types="node" />
// RV1 · Production build isolation (live project): AC28 — a production web export in live mode has no mock code.
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {expect, test} from "@playwright/test";

const ROOT = path.resolve(__dirname, "..");

function files(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? files(full) : [full];
    });
}

test("AC28: `expo export --platform web` in live mode contains no mock modules, fixtures or __mock", async () => {
    test.setTimeout(300_000);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rv1-export-"));
    try {
        execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", out], {
            cwd: ROOT,
            env: {...process.env, EXPO_PUBLIC_API_MODE: "live", EXPO_PUBLIC_API_URL: "https://api.example.com",
                NODE_ENV: "production"},
            stdio: "pipe",
            timeout: 280_000,
        });
        const js = files(out).filter((f) => f.endsWith(".js"));
        expect(js.length).toBeGreaterThan(0);
        const bundle = js.map((f) => fs.readFileSync(f, "utf8")).join("\n");
        for (const marker of ["__mock", "MOCK_CODE", "demo@rupiverse.app", "new@rupiverse.app", "mock-access",
            "services/mock", "setScenario"]) {
            expect(bundle.includes(marker), `production bundle contains "${marker}"`).toBe(false);
        }
    } finally {
        fs.rmSync(out, {recursive: true, force: true});
    }
});
