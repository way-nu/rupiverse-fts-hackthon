/// <reference types="node" />
// RV1 · frontend/CLAUDE.md update (static, mock project): AC29.
// The diff against master may touch only line 61 (design/ folder-tree entry), lines 74–75 (Designs bullet) and line 79
// (Theme line), master numbering; the change must be its own docs commit.
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {expect, test} from "@playwright/test";

const ROOT = path.resolve(__dirname, "..");
const FILE = "frontend/CLAUDE.md";
const ALLOWED_OLD_LINES = new Set([61, 74, 75, 79]);
const BASE = process.env.AC29_BASE ?? "origin/master";

// Paths below are repo-relative (frontend/CLAUDE.md), so git runs from the repo root.
const REPO = path.resolve(ROOT, "..");
const git = (...args: string[]): string => execFileSync("git", args, {cwd: REPO, encoding: "utf8"});
const mergeBase = (): string => git("merge-base", BASE, "HEAD").trim();

test.describe("RV1 frontend/CLAUDE.md (AC29)", () => {
    // AC29's diff and commit checks inspect the RV1 frontend PR's own change to frontend/CLAUDE.md. Once that change is
    // on the base branch (the old "Calm (light) only for now" line is gone there), there is no RV1 PR diff left to
    // inspect: on master and on every later branch they are skipped, with a reason that says so. The content check
    // below still guards the file everywhere.
    const SKIP_REASON = "AC29 diff/commit checks apply only to the RV1 frontend PR; its CLAUDE.md change is already on "
        + `${BASE}, so there is nothing to diff (skipped, not passed). The content check still runs.`;
    const rv1DocsChangeOnBase = (): boolean =>
        !git("show", `${BASE}:${FILE}`).includes("Calm (light) only for now");

    test("AC29: the diff touches only lines 61, 74–75 and 79 of master's frontend/CLAUDE.md", async () => {
        test.skip(rv1DocsChangeOnBase(), SKIP_REASON);
        const diff = git("diff", "--unified=0", mergeBase(), "HEAD", "--", FILE);
        expect(diff, "frontend/CLAUDE.md is not changed on this branch").not.toBe("");
        const touched: number[] = [];
        for (const match of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/gm)) {
            const start = Number(match[1]);
            const count = match[2] === undefined ? 1 : Number(match[2]);
            if (count === 0) {
                touched.push(start + 0.5); // pure insertion after `start`: never allowed
            }
            for (let line = start; line < start + count; line++) {
                touched.push(line);
            }
        }
        expect(touched.length).toBeGreaterThan(0);
        expect(touched.filter((line) => !ALLOWED_OLD_LINES.has(line)), `touched master lines: ${touched}`).toEqual([]);
    });

    test("AC29: the file now says both themes and points to the JSX export in frontend/design/", async () => {
        const text = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
        expect(text).not.toContain("Calm (light) only for now");
        expect(text).not.toMatch(/design\/rv<n>\//);
        expect(text).not.toMatch(/PNG per screen/i);
        expect(text).toMatch(/Midnight/);
        expect(text).toMatch(/Calm/);
        expect(text).toMatch(/JSX/);
        expect(text).toMatch(/frontend\/design\/|`design\/`/);
    });

    test("AC29: the change is its own docs(rv1) commit touching only frontend/CLAUDE.md", async () => {
        test.skip(rv1DocsChangeOnBase(), SKIP_REASON);
        const commits = git("log", "--format=%H", `${mergeBase()}..HEAD`, "--", FILE).split("\n").filter(Boolean);
        expect(commits.length, "no commit on this branch touches frontend/CLAUDE.md").toBeGreaterThan(0);
        for (const sha of commits) {
            const files = git("show", "--name-only", "--format=", sha).split("\n").filter(Boolean);
            const subject = git("show", "-s", "--format=%s", sha).trim();
            expect(files, `${sha.slice(0, 7)} "${subject}" must touch only ${FILE}`).toEqual([FILE]);
            expect(subject, `${sha.slice(0, 7)} must be a docs(rv1) commit`).toMatch(/^docs\(rv1\):/);
        }
    });
});
