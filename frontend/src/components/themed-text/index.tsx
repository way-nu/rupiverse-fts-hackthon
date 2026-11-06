import {Text, type TextProps} from "react-native";

import {type ThemeColors} from "@/constants/theme";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

export type ThemedTextType = keyof typeof styles;

export type ThemedTextProps = TextProps & {
    type?: ThemedTextType;
    tone?: keyof Pick<ThemeColors, "ink" | "ink2" | "ink3" | "accent" | "accentInk" | "negative" | "positive">;
};

const DEFAULT_TONE: Record<ThemedTextType, NonNullable<ThemedTextProps["tone"]>> = {
    body: "ink",
    title: "ink",
    subtitle: "ink2",
    label: "ink2",
    small: "ink3",
    footer: "ink2",
    link: "accent",
    error: "negative",
    button: "accentInk",
    strong: "ink",
    smallStrong: "ink2",
    overline: "ink3",
    linkSmall: "accent",
    digit: "ink",
    field: "ink",
    segment: "ink2",
    segmentOn: "ink",
    hint: "ink3",
    avatar: "accentInk",
    brandWord: "accentInk",
    tagline: "accentInk",
    subline: "accentInk",
    place: "accentInk",
    backLink: "ink2",
    logoWord: "ink",
    glyph: "accentInk",
    soon: "ink3",
    badge: "ink3",
};

export function ThemedText({type = "body", tone, style, ...rest}: ThemedTextProps) {
    const theme = useTheme();
    return <Text style={[styles[type], {color: theme[tone ?? DEFAULT_TONE[type]]}, style]} {...rest} />;
}
