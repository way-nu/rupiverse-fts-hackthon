import {useColorScheme} from "react-native";

import {Colors, type ThemeColors} from "@/constants/theme";

export type Scheme = "light" | "dark";

// Follows the device / browser colour scheme and updates live when it changes.
export function useScheme(): Scheme {
    return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme(): ThemeColors {
    return Colors[useScheme()];
}
