// ESLint flat config.
// Code-quality rules come from Expo; formatting rules mirror the default
// JetBrains WebStorm code style for JavaScript/TypeScript, so code formatted
// with WebStorm's "Reformat Code" passes lint and vice versa.
// The matching WebStorm (ij_*) settings live in .editorconfig.
import {defineConfig} from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
    expoConfig,
    {
        // design/ holds design prototypes and mockups, not app code: excluded from lint and the pre-commit hook
        ignores: ["dist/*", ".expo/*", "android/*", "ios/*", "web-build/*", "design/**", "src/types/api.gen.ts"],
    },
    {
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            // Tabs and indents: 4 spaces, "case" indented inside "switch"
            "@stylistic/indent": ["error", 4, {SwitchCase: 1}],
            "@stylistic/no-tabs": "error",
            "@stylistic/jsx-indent-props": ["error", 4],

            // Wrapping: hard wrap at 120 columns
            "@stylistic/max-len": ["warn", {
                code: 120,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreRegExpLiterals: true,
            }],

            // Punctuation: double quotes, always use semicolons, keep trailing commas as written
            "@stylistic/quotes": ["error", "double", {avoidEscape: true}],
            "@stylistic/jsx-quotes": ["error", "prefer-double"],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/comma-dangle": "off",

            // Spaces within braces:
            //   object literals, destructuring, imports/exports -> no spaces: {a: 1}, import {View}
            //   type literals, interfaces, enums -> spaces: { a: string }
            "@stylistic/object-curly-spacing": ["error", "never", {
                overrides: {
                    TSTypeLiteral: "always",
                    TSInterfaceBody: "always",
                    TSMappedType: "always",
                    TSEnumBody: "always",
                },
            }],
            "@stylistic/array-bracket-spacing": ["error", "never"],
            "@stylistic/computed-property-spacing": ["error", "never"],
            "@stylistic/space-in-parens": ["error", "never"],
            "@stylistic/template-curly-spacing": ["error", "never"],
            "@stylistic/jsx-curly-spacing": ["error", {when: "never", children: true}],
            "@stylistic/block-spacing": ["error", "always"],

            // Spaces around operators and keywords
            "@stylistic/space-infix-ops": "error",
            "@stylistic/space-unary-ops": "error",
            "@stylistic/arrow-spacing": "error",
            "@stylistic/keyword-spacing": "error",
            "@stylistic/space-before-blocks": "error",
            "@stylistic/comma-spacing": "error",
            "@stylistic/semi-spacing": "error",
            "@stylistic/key-spacing": ["error", {beforeColon: false, afterColon: true}],
            "@stylistic/type-annotation-spacing": "error",
            "@stylistic/jsx-equals-spacing": ["error", "never"],
            "@stylistic/jsx-tag-spacing": ["error", {beforeSelfClosing: "always"}],

            // Function parentheses: function () {}, function foo() {}, async () => {}
            "@stylistic/space-before-function-paren": ["error", {
                anonymous: "always",
                named: "never",
                asyncArrow: "always",
            }],
            "@stylistic/function-call-spacing": ["error", "never"],

            // Braces placement: end of line, "else"/"catch"/"finally" on the same line
            "@stylistic/brace-style": ["error", "1tbs", {allowSingleLine: true}],

            // Blank lines: keep at most 2, file ends with a newline, no trailing whitespace
            "@stylistic/no-multiple-empty-lines": ["error", {max: 2, maxEOF: 0}],
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/no-multi-spaces": "error",
        },
    },
]);
