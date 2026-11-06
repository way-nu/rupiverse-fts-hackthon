import {StyleSheet} from "react-native";

import {Fonts, Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    labelRow: {flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5,
        marginLeft: 2},
    box: {flexDirection: "row", alignItems: "center", height: 46, borderRadius: Radius.m, borderWidth: 1,
        overflow: "hidden"},
    input: {flex: 1, height: "100%", paddingLeft: 14, paddingRight: 12, fontFamily: Fonts.regular, fontSize: 14.5,
        outlineStyle: "none" as never},
    prefix: {height: "100%", justifyContent: "center", paddingLeft: 12, paddingRight: 8, marginRight: 10,
        borderRightWidth: 1},
    inputAfterPrefix: {paddingLeft: 0},
    icon: {marginRight: 12},
    error: {marginTop: 5, marginLeft: 2},
});
