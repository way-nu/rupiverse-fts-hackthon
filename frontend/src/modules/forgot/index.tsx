// Forgot password (design variant `forgot`, Spec §9.4).
import {View} from "react-native";

import {AuthField} from "@/components/auth-field";
import {AuthShell} from "@/components/auth-shell";
import {FormMessage} from "@/components/form-message";
import {PrimaryButton} from "@/components/primary-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";

import {TEXT} from "./constants";
import {useForgot} from "./hooks";
import {styles} from "./styles";

export default function ForgotScreen() {
    const forgot = useForgot();
    return (
        <AuthShell onBack={forgot.goLogin}>
            <View testID="forgot-screen">
                <View style={styles.header}>
                    <ThemedText type="title">{TEXT.title}</ThemedText>
                    <ThemedText type="subtitle" style={styles.subtitle}>{TEXT.subtitle}</ThemedText>
                </View>
                <View style={styles.form}>
                    {forgot.error && <FormMessage testID="forgot-error">{forgot.error}</FormMessage>}
                    <AuthField testID="forgot-email" label={TEXT.email} value={forgot.email}
                        onChangeText={forgot.setEmail} onBlur={forgot.blurEmail} error={forgot.emailError}
                        errorTestID="forgot-email-error" valid={forgot.emailValid} inputMode="email"
                        keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false}
                        onSubmitEditing={forgot.submit} />
                    <PrimaryButton testID="forgot-submit" label={TEXT.submit} onPress={forgot.submit}
                        disabled={!forgot.canSubmit} busy={forgot.busy} />
                </View>
                <ThemedText type="footer" style={styles.footer}>
                    {TEXT.footer} <TextLink testID="forgot-login-link" onPress={forgot.goLogin}>{TEXT.login}</TextLink>
                </ThemedText>
            </View>
        </AuthShell>
    );
}
