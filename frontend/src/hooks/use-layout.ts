import {Platform, useWindowDimensions} from "react-native";

import {MaxContentWidth, Spacing} from "@/constants/theme";

export type WidthClass = "compact" | "medium" | "expanded";

const COMPACT_MAX = 600;
const EXPANDED_MIN = 1024;

export function widthClassFor(width: number, height: number): WidthClass {
    if (width >= EXPANDED_MIN) {
        return "expanded";
    }
    // A wide, short window (a phone in landscape) also counts as expanded on native.
    if (Platform.OS !== "web" && width > height && height < COMPACT_MAX) {
        return "expanded";
    }
    return width < COMPACT_MAX ? "compact" : "medium";
}

// Only containers respond to the window; fonts, paddings and buttons keep the design's fixed sizes.
export function useLayout() {
    const {width, height} = useWindowDimensions();
    const widthClass = widthClassFor(width, height);
    const contentWidth = Math.min(width, MaxContentWidth);
    return {
        width,
        height,
        widthClass,
        contentWidth,
        margin: Math.max(Spacing.l, (width - contentWidth) / 2),
        // Auth screens: brand split only on web at >= 1024 px (Spec §9); native always uses the mobile layout.
        isDesktopAuth: Platform.OS === "web" && width >= EXPANDED_MIN,
        pick<T>(values: { compact: T; medium?: T; expanded?: T }): T {
            if (widthClass === "expanded") {
                return values.expanded ?? values.medium ?? values.compact;
            }
            return widthClass === "medium" ? values.medium ?? values.compact : values.compact;
        },
    };
}
