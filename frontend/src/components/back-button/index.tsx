// The round back chevron from the mobile auth frame (frontend/design/rupiverse-auth.jsx: AuthScreen).
import {Pressable} from "react-native";
import Svg, {Path} from "react-native-svg";

import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

type Props = { testID: string; onPress: () => void; label?: string };

export function Chevron({color, size}: { color: string; size: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 6l-6 6 6 6" />
        </Svg>
    );
}

export function BackButton({testID, onPress, label = "Back"}: Props) {
    const theme = useTheme();
    return (
        <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
            style={[styles.round, {backgroundColor: theme.surface, borderColor: theme.border}]}>
            <Chevron color={theme.ink} size={18} />
        </Pressable>
    );
}
