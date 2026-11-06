import {StyleSheet} from "react-native";

import {Spacing} from "@/constants/theme";

import {FORM_MAX_WIDTH} from "./constants";

export const styles = StyleSheet.create({
    page: {flex: 1},
    scroll: {flex: 1},
    content: {flexGrow: 1, alignItems: "center", paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl},
    column: {width: "100%", maxWidth: FORM_MAX_WIDTH},
    topRow: {flexDirection: "row", alignItems: "center", paddingTop: Spacing.s, minHeight: 40},
    header: {marginTop: 18, marginBottom: 22},
    form: {gap: 15},
    state: {alignItems: "center", gap: Spacing.m, paddingVertical: Spacing.xxl},
});
