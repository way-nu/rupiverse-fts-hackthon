import {type ComponentRef, useRef, useState} from "react";
import {type TextInput} from "react-native";

export const CODE_LENGTH = 6;

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

// The cells are only a display; tapping them focuses the real input. On iOS an input at opacity 0 is skipped by
// hit-testing, so without this a tap never reaches it and the keyboard never opens (PR #7 bug 4).
export function useOtpFocus() {
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
    return {
        focused,
        inputRef,
        focusInput: () => inputRef.current?.focus(),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
    };
}
