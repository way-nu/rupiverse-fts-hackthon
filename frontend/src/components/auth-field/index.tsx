// Label + input with error (red) and valid (green check) states (frontend/design/rupiverse-auth.jsx: AuthField).
import {type ReactNode} from "react";
import {TextInput, type TextInputProps, View} from "react-native";
import Svg, {Circle, Path} from "react-native-svg";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

export type AuthFieldProps = TextInputProps & {
    label: string;
    labelRight?: ReactNode;
    error?: string | null;
    errorTestID?: string;
    valid?: boolean;
    rightSlot?: ReactNode;
    below?: ReactNode;
};

export function AuthField(props: AuthFieldProps) {
    const {label, labelRight, error, errorTestID, valid, rightSlot, below, style, ...input} = props;
    const theme = useTheme();
    const borderColor = error ? theme.negative : valid ? theme.positive : theme.borderStrong;
    return (
        <View>
            <View style={styles.labelRow}>
                <ThemedText type="label">{label}</ThemedText>
                {labelRight}
            </View>
            <View style={[styles.box, {backgroundColor: theme.surface, borderColor}]}>
                <TextInput placeholderTextColor={theme.ink3} style={[styles.input, {color: theme.ink}, style]}
                    {...input} />
                {rightSlot}
                {!rightSlot && valid && !error && (
                    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={theme.positive}
                        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={styles.icon}>
                        <Path d="M3 8.5l3 3 7-7" />
                    </Svg>
                )}
                {!rightSlot && error && (
                    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={theme.negative}
                        strokeWidth={2} strokeLinecap="round" style={styles.icon}>
                        <Circle cx={8} cy={8} r={6.5} />
                        <Path d="M8 5v3.5M8 11h0" />
                    </Svg>
                )}
            </View>
            {error ? <ThemedText type="error" testID={errorTestID} style={styles.error}>{error}</ThemedText> : null}
            {below}
        </View>
    );
}
