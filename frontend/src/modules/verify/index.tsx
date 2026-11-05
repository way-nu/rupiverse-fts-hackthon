// Verify email (design variant `otp`, Spec §9.3).
import {Redirect} from "expo-router";
import {View} from "react-native";

import {AuthShell} from "@/components/auth-shell";
import {CodeEntry} from "@/components/code-entry";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";

import {TEXT} from "./constants";
import {useVerify} from "./hooks";
import {styles} from "./styles";

export default function VerifyScreen() {
    const verify = useVerify();
    if (!verify.email) {
        return <Redirect href="/signup" />;
    }
    return (
        <AuthShell onBack={verify.changeEmail}>
            <View testID="verify-screen">
                <View style={styles.header}>
                    <ThemedText type="title">{TEXT.title}</ThemedText>
                    <ThemedText type="subtitle" style={styles.subtitle}>
                        {TEXT.subtitleStart}
                        <ThemedText testID="verify-email" type="strong">{verify.email}</ThemedText>
                        {TEXT.subtitleEnd}
                    </ThemedText>
                </View>
                <CodeEntry testIDPrefix="verify" submitLabel={TEXT.submit} entry={verify.entry} />
                <ThemedText type="footer" style={styles.footer}>
                    {TEXT.footer} <TextLink testID="verify-change-email"
                        onPress={verify.changeEmail}>{TEXT.change}</TextLink>
                </ThemedText>
            </View>
        </AuthShell>
    );
}
