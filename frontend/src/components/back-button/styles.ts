import {StyleSheet} from "react-native";

import {Radius} from "@/constants/theme";

export const styles = StyleSheet.create({
    round: {width: 36, height: 36, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center",
        borderWidth: 1},
});
