import {StyleSheet} from "react-native";

import {Fonts} from "@/constants/theme";

export const styles = StyleSheet.create({
    tile: {alignItems: "center", justifyContent: "center", overflow: "hidden"},
    svg: {position: "absolute", left: 0, top: 0},
    glyph: {fontFamily: Fonts.bold, letterSpacing: -0.5, includeFontPadding: false},
    inline: {flexDirection: "row", alignItems: "center", gap: 9},
    word: {fontFamily: Fonts.semibold, letterSpacing: -0.34},
});
