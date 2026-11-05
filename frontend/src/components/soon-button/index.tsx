// Disabled "Continue with …" button with the "Soon" badge (SSO and phone login are future tickets).
import {Pressable, View} from "react-native";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

export function SoonButton({testID, label}: { testID: string; label: string }) {
    const theme = useTheme();
    return (
        <Pressable testID={testID} accessibilityRole="button" disabled aria-disabled
            style={[styles.button, {backgroundColor: theme.surface, borderColor: theme.border}]}>
            <ThemedText type="soon">{label}</ThemedText>
            <View style={[styles.badge, {backgroundColor: theme.sunken}]}>
                <ThemedText type="badge">Soon</ThemedText>
            </View>
        </Pressable>
    );
}
