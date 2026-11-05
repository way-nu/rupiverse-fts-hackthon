import {StyleSheet} from "react-native";

import {Fonts, Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    button: {width: "100%", height: 46, borderRadius: Radius.m, borderWidth: 1, alignItems: "center",
        justifyContent: "center"},
    label: {fontFamily: Fonts.medium, fontSize: 13.5},
    badge: {position: "absolute", right: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill},
    badgeText: {fontFamily: Fonts.semibold, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase"},
});
