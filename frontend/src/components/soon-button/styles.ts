import {StyleSheet} from "react-native";

import {Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    button: {width: "100%", height: 46, borderRadius: Radius.m, borderWidth: 1, alignItems: "center",
        justifyContent: "center"},
    badge: {position: "absolute", right: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill},
});
