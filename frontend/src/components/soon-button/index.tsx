// Disabled "Continue with …" button with the "Soon" badge (SSO and phone login are future tickets).
import {Pressable, Text, View} from "react-native";

import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

export function SoonButton({testID, label}: { testID: string; label: string }) {
    const theme = useTheme();
    return (
        <Pressable testID={testID} accessibilityRole="button" disabled aria-disabled
            style={[styles.button, {backgroundColor: theme.surface, borderColor: theme.border}]}>
            <Text style={[styles.label, {color: theme.ink3}]}>{label}</Text>
            <View style={[styles.badge, {backgroundColor: theme.sunken}]}>
                <Text style={[styles.badgeText, {color: theme.ink3}]}>Soon</Text>
            </View>
        </Pressable>
    );
}
