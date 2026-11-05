// Reset code (design variant `forgot-otp`, Spec §9.5).
import {Redirect} from "expo-router";
import {View} from "react-native";

import {AuthShell} from "@/components/auth-shell";
import {CodeEntry} from "@/components/code-entry";
import {ThemedText} from "@/components/themed-text";

import {TEXT} from "./constants";
import {useForgotCode} from "./hooks";
import {styles} from "./styles";

export default function ForgotCodeScreen() {
    const forgotCode = useForgotCode();
    if (!forgotCode.email) {
        return <Redirect href="/forgot" />;
    }
    return (
        <AuthShell onBack={forgotCode.back}>
            <View testID="forgot-code-screen">
                <View style={styles.header}>
                    <ThemedText type="title">{TEXT.title}</ThemedText>
                    <ThemedText type="subtitle" style={styles.subtitle}>
                        {TEXT.subtitleStart}
                        <ThemedText testID="forgot-code-email" type="strong">{forgotCode.email}</ThemedText>
                        {TEXT.subtitleEnd}
                    </ThemedText>
                </View>
                <CodeEntry testIDPrefix="forgot-code" submitLabel={TEXT.submit} entry={forgotCode.entry} />
            </View>
        </AuthShell>
    );
}
