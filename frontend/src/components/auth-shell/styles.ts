import {StyleSheet} from "react-native";

import {FORM_MAX_WIDTH, WATERMARK_SIZE} from "./constants";

export const styles = StyleSheet.create({
    desktop: {flex: 1, flexDirection: "row", minHeight: "100%"},
    brand: {flex: 1, flexBasis: 0, padding: 48, justifyContent: "space-between", overflow: "hidden"},
    watermark: {position: "absolute", right: -80, bottom: -80, opacity: 0.12},
    brandLogo: {flexDirection: "row", alignItems: "center", gap: 10},
    tagline: {maxWidth: 360},
    subline: {opacity: 0.85, marginTop: 14, maxWidth: 320},
    place: {opacity: 0.7},
    formColumn: {flex: 1, flexBasis: 0, alignItems: "center", justifyContent: "center", padding: 40},
    formInner: {width: "100%", maxWidth: FORM_MAX_WIDTH},
    backLink: {flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 18, alignSelf: "flex-start"},
    mobile: {flex: 1},
    mobileContent: {flexGrow: 1},
    topRow: {flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, paddingHorizontal: 16, minHeight: 40},
    backRound: {width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center"},
    spacer: {width: 36, height: 36},
    logoRow: {paddingTop: 14, paddingHorizontal: 24, paddingBottom: 6, alignItems: "center"},
    mobileForm: {flex: 1, paddingTop: 18, paddingHorizontal: 24, paddingBottom: 20},
    watermarkSize: {width: WATERMARK_SIZE, height: WATERMARK_SIZE},
});
