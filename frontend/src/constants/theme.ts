// Design tokens ported from frontend/design/rupiverse-theme.jsx: Calm (light) and Midnight (dark).
import {Platform} from "react-native";

export type ThemeColors = {
    page: string;
    surface: string;
    sunken: string;
    ink: string;
    ink2: string;
    ink3: string;
    accent: string;
    accentInk: string;
    accentSoft: string;
    positive: string;
    positiveSoft: string;
    negative: string;
    negativeSoft: string;
    border: string;
    borderStrong: string;
    chipBg: string;
};

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
    // Calm
    light: {
        page: "#FAFAF7",
        surface: "#FFFFFF",
        sunken: "#F1F0EC",
        ink: "#0E0E0C",
        ink2: "#5A5A55",
        ink3: "#8E8E88",
        accent: "#1F5A50",
        accentInk: "#FFFFFF",
        accentSoft: "#E7EFEC",
        positive: "#0E7A3F",
        positiveSoft: "#E8F3EC",
        negative: "#A02528",
        negativeSoft: "#F6E9E7",
        border: "rgba(14,14,12,0.08)",
        borderStrong: "rgba(14,14,12,0.14)",
        chipBg: "#F1F0EC",
    },
    // Midnight
    dark: {
        page: "#0E0E10",
        surface: "#18181B",
        sunken: "#1E1E21",
        ink: "#EDEDEA",
        ink2: "#A0A09C",
        ink3: "#6B6B67",
        accent: "#5FB58A",
        accentInk: "#0E0E10",
        accentSoft: "#15281F",
        positive: "#5FB58A",
        positiveSoft: "#15281F",
        negative: "#D77272",
        negativeSoft: "#2A1818",
        border: "rgba(237,237,234,0.08)",
        borderStrong: "rgba(237,237,234,0.18)",
        chipBg: "#222226",
    },
};

// Geist weights loaded in the root layout (expo-font). Family names match the @expo-google-fonts/geist exports.
export const Fonts = {
    regular: "Geist_400Regular",
    medium: "Geist_500Medium",
    semibold: "Geist_600SemiBold",
    bold: "Geist_700Bold",
    fallback: Platform.select({web: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif"}) ?? "System",
};

export const Radius = {s: 8, m: 12, l: 18, xl: 24, pill: 999};

export const Spacing = {xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32};

export const MaxContentWidth = 1200;
