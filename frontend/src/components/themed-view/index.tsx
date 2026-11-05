import {View, type ViewProps} from "react-native";

import {type ThemeColors} from "@/constants/theme";
import {useTheme} from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
    surface?: keyof Pick<ThemeColors, "page" | "surface" | "sunken" | "accent">;
};

export function ThemedView({surface = "page", style, ...rest}: ThemedViewProps) {
    const theme = useTheme();
    return <View style={[{backgroundColor: theme[surface]}, style]} {...rest} />;
}
