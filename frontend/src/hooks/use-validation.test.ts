import {describe, expect, it} from "@jest/globals";
import {isPasswordTooLong, isPasswordValid, isValidEmail, passwordChecks, utf8Bytes} from "./use-validation";

describe("password rules", () => {
    it("counts UTF-8 bytes, not characters", () => {
        expect(utf8Bytes("€")).toBe(3);
        expect(isPasswordTooLong("Ab1!" + "€".repeat(23))).toBe(true); // 73 bytes, 27 chars
        expect(isPasswordTooLong("Ab1!" + "€".repeat(22) + "xx")).toBe(false); // 72 bytes
    });

    it("ticks each rule independently, including lowercase", () => {
        expect(passwordChecks("a")).toEqual({length: false, upper: false, lower: true, number: false, special: false});
        expect(passwordChecks("aB3!wxyz")).toEqual({length: true, upper: true, lower: true, number: true, special: true});
    });

    it("needs every rule and at most 72 bytes", () => {
        expect(isPasswordValid("ABCD123!")).toBe(false);
        expect(isPasswordValid("ABCd123!")).toBe(true);
        expect(isPasswordValid("Ab1!" + "x".repeat(69))).toBe(false);
    });
});

describe("email", () => {
    it.each(["a@b.co", " demo@rupiverse.app "])("accepts %s", (email) => expect(isValidEmail(email)).toBe(true));
    it.each(["not-an-email", "a@", "@x.com", "a b@x.com", ""])("rejects %s", (email) => {
        expect(isValidEmail(email)).toBe(false);
    });
});
