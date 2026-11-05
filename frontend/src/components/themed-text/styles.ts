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
});
