// Initial-letter avatar (frontend/design/rupiverse-extras.jsx: account footer tile); opens the Profile page.
import {Pressable} from "react-native";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

type Props = { testID: string; initial: string; label: string; onPress: () => void };

export function ProfileButton({testID, initial, label, onPress}: Props) {
    const theme = useTheme();
    return (
        <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
            style={[styles.tile, {backgroundColor: theme.accent}]}>
            <ThemedText type="avatar">{initial}</ThemedText>
        </Pressable>
    );
}
