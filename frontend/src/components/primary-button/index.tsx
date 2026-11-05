// AuthPrimary from the design: full-width accent button with a disabled style. Busy = disabled + spinner.
import {ActivityIndicator, Pressable} from "react-native";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

type Props = {
    testID: string;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
};

export function PrimaryButton({testID, label, onPress, disabled = false, busy = false}: Props) {
    const theme = useTheme();
    const off = disabled || busy;
    return (
        <Pressable testID={testID} accessibilityRole="button" disabled={off} aria-disabled={off} aria-busy={busy}
            onPress={onPress} style={[styles.button, {backgroundColor: off && !busy ? theme.chipBg : theme.accent}]}>
            {busy && <ActivityIndicator size="small" color={theme.accentInk} />}
            <ThemedText type="button" tone={off && !busy ? "ink3" : "accentInk"}>{label}</ThemedText>
        </Pressable>
    );
}
