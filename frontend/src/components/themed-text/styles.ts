import {StyleSheet} from "react-native";

import {Fonts} from "@/constants/theme";

export const styles = StyleSheet.create({
    body: {fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20},
    title: {fontFamily: Fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.52},
    subtitle: {fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20},
    label: {fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16},
    small: {fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18},
    footer: {fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19},
    link: {fontFamily: Fonts.semibold, fontSize: 13.5, lineHeight: 19},
    error: {fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16},
    button: {fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: 0.16},
    strong: {fontFamily: Fonts.semibold, fontSize: 14, lineHeight: 20},
    smallStrong: {fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 18},
    overline: {fontFamily: Fonts.regular, fontSize: 11.5, letterSpacing: 0.7, textTransform: "uppercase"},
    linkSmall: {fontFamily: Fonts.semibold, fontSize: 12, lineHeight: 16},
    digit: {fontFamily: Fonts.semibold, fontSize: 24},
    // AuthField prefix (+91) and GenderSelect options (frontend/design/rupiverse-auth.jsx)
    field: {fontFamily: Fonts.regular, fontSize: 14.5},
    segment: {fontFamily: Fonts.medium, fontSize: 13.5},
    segmentOn: {fontFamily: Fonts.semibold, fontSize: 13.5, fontWeight: "600"},
    hint: {fontFamily: Fonts.regular, fontSize: 11},
    // Initial-letter avatar tile (frontend/design/rupiverse-extras.jsx: account footer)
    avatar: {fontFamily: Fonts.bold, fontSize: 13, fontWeight: "700"},
    // Auth brand panel (frontend/design/rupiverse-auth.jsx: DesktopAuth)
    brandWord: {fontFamily: Fonts.semibold, fontSize: 22},
    tagline: {fontFamily: Fonts.semibold, fontSize: 34, lineHeight: 41, letterSpacing: -0.68},
    subline: {fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21},
    place: {fontFamily: Fonts.regular, fontSize: 12},
    backLink: {fontFamily: Fonts.medium, fontSize: 13},
    // Logo lockup and ₹ glyph; the size-dependent font size is set by the Logo component
    logoWord: {fontFamily: Fonts.semibold, letterSpacing: -0.34},
    glyph: {fontFamily: Fonts.bold, letterSpacing: -0.5, includeFontPadding: false},
    // "Continue with …" + "Soon" badge
    soon: {fontFamily: Fonts.medium, fontSize: 13.5},
    badge: {fontFamily: Fonts.semibold, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase"},
});
