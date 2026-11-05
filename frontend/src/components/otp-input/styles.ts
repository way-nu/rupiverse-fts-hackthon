import {StyleSheet} from "react-native";

import {Fonts, Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    wrap: {position: "relative", alignSelf: "center"},
    row: {flexDirection: "row", gap: 8, justifyContent: "center"},
    cell: {width: 46, height: 56, borderRadius: Radius.m, borderWidth: 1.5, alignItems: "center",
        justifyContent: "center"},
    digit: {fontFamily: Fonts.semibold, fontSize: 24},
    caret: {width: 2, height: 24, borderRadius: 1},
    // One real input over the cells takes typing and paste; the cells only display it.
    input: {position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity: 0, fontSize: 24,
        outlineStyle: "none" as never},
});
