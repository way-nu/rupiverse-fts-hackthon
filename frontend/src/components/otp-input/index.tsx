// Six code cells (frontend/design/rupiverse-auth.jsx: OTPInput) driven by one numeric input that accepts a paste.
import {Pressable, TextInput, View} from "react-native";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {CODE_LENGTH, digitsOnly, useOtpFocus} from "./hooks";
import {styles} from "./styles";

type Props = {
    testIDPrefix: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
};

export function OtpInput({testIDPrefix, value, onChange, disabled = false}: Props) {
    const theme = useTheme();
    const {focused, inputRef, focusInput, onFocus, onBlur} = useOtpFocus();
    const active = Math.min(value.length, CODE_LENGTH - 1);
    return (
        <View style={styles.wrap}>
            <Pressable style={styles.row} onPress={focusInput} disabled={disabled} accessible={false}>
                {Array.from({length: CODE_LENGTH}, (_, i) => {
                    const ch = value[i];
                    const isActive = focused && !disabled && i === active;
                    return (
                        <View key={i} testID={`${testIDPrefix}-code-cell-${i}`} style={[styles.cell, {
                            backgroundColor: disabled ? theme.sunken : theme.surface,
                            borderColor: isActive ? theme.accent : ch ? theme.borderStrong : theme.border,
                        }]}>
                            {ch ? <ThemedText type="digit">{ch}</ThemedText>
                                : isActive && <View style={[styles.caret, {backgroundColor: theme.accent}]} />}
                        </View>
                    );
                })}
            </Pressable>
            <TextInput ref={inputRef} testID={`${testIDPrefix}-code-input`} value={value}
                onChangeText={(text) => onChange(digitsOnly(text))} inputMode="numeric" keyboardType="number-pad"
                autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={CODE_LENGTH}
                editable={!disabled} aria-disabled={disabled} accessibilityLabel="6-digit code"
                onFocus={onFocus} onBlur={onBlur} caretHidden style={styles.input} />
        </View>
    );
}
