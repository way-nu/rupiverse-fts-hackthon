import {StyleSheet} from "react-native";

import {Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    button: {width: "100%", height: 50, borderRadius: Radius.m, alignItems: "center", justifyContent: "center",
        flexDirection: "row", gap: 8},
});
