import {StyleSheet} from "react-native";

import {Radius} from "@/constants/theme";

// The avatar tile in the design's desktop account footer: 32×32, radius 8.
export const styles = StyleSheet.create({
    tile: {width: 32, height: 32, borderRadius: Radius.s, alignItems: "center", justifyContent: "center"},
});
