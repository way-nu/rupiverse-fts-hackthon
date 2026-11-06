import {StyleSheet} from "react-native";

import {Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    labelRow: {flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5,
        marginLeft: 2},
    track: {flexDirection: "row", borderRadius: Radius.pill, padding: 3},
    option: {flex: 1, height: 36, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center"},
    selected: {boxShadow: "0 1px 2px rgba(0,0,0,0.08)"},
});
