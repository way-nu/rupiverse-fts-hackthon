import {useState} from "react";

export const CODE_LENGTH = 6;

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export function useOtpFocus() {
    const [focused, setFocused] = useState(false);
    return {focused, onFocus: () => setFocused(true), onBlur: () => setFocused(false)};
}
