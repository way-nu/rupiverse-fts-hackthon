// A form-level message under the title: an error (red) or a success banner (green). Children may include links.
import {type ReactNode} from "react";
import {View} from "react-native";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

type Props = { testID: string; tone?: "error" | "success"; children: ReactNode };

export function FormMessage({testID, tone = "error", children}: Props) {
    const theme = useTheme();
    const error = tone === "error";
    return (
        <View testID={testID} role={error ? "alert" : "status"}
            style={[styles.box, {backgroundColor: error ? theme.negativeSoft : theme.positiveSoft}]}>
            <ThemedText type="small" tone={error ? "negative" : "positive"} style={styles.text}>{children}</ThemedText>
        </View>
    );
}
