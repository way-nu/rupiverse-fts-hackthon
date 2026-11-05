// Root layout: Geist, safe areas, session status, status bar. Renders the routes once fonts and session are known.
import {Slot} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {View} from "react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";

import {SessionProvider} from "@/hooks/use-session";
import {useScheme, useTheme} from "@/hooks/use-theme";

import {useRootLayout} from "./hooks";
import {styles} from "./styles";

export default function RootLayout() {
    const {ready} = useRootLayout();
    const theme = useTheme();
    const scheme = useScheme();
    return (
        <SafeAreaProvider>
            <SessionProvider>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                <View style={[styles.root, {backgroundColor: theme.page}]}>
                    {ready ? <Slot /> : null}
                </View>
            </SessionProvider>
        </SafeAreaProvider>
    );
}
