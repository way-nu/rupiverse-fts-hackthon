// Login (design variant `login`, Spec §9.1).
import {View} from "react-native";

import {AuthField} from "@/components/auth-field";
import {AuthShell} from "@/components/auth-shell";
import {FormMessage} from "@/components/form-message";
import {PasswordField} from "@/components/password-field";
import {PrimaryButton} from "@/components/primary-button";
import {SoonButton} from "@/components/soon-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {TEXT} from "./constants";
import {useLogin} from "./hooks";
import {styles} from "./styles";

export default function LoginScreen() {
    const theme = useTheme();
    const login = useLogin();
    return (
        <AuthShell>
            <View testID="login-screen">
                <View style={styles.header}>
                    <ThemedText testID="login-title" type="title">{TEXT.title}</ThemedText>
                    <ThemedText type="subtitle" style={styles.subtitle}>{TEXT.subtitle}</ThemedText>
                </View>
                <View style={styles.form}>
                    {login.showResetBanner && (
                        <FormMessage testID="login-banner" tone="success">{TEXT.resetBanner}</FormMessage>
                    )}
                    {login.error && <FormMessage testID="login-error">{login.error}</FormMessage>}
                    <AuthField testID="login-email" label={TEXT.email} value={login.email} onChangeText={login.setEmail}
                        inputMode="email" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                        autoCorrect={false} onSubmitEditing={login.submit} />
                    <PasswordField testID="login-password" toggleTestID="login-password-toggle" label={TEXT.password}
                        value={login.password} onChangeText={login.setPassword} autoComplete="current-password"
                        onSubmitEditing={login.submit}
                        forgot={<TextLink testID="login-forgot" type="linkSmall"
                            onPress={login.goForgot}>{TEXT.forgot}</TextLink>} />
                    <PrimaryButton testID="login-submit" label={TEXT.submit} onPress={login.submit}
                        disabled={!login.canSubmit} busy={login.busy} />
                </View>
                <View style={styles.divider}>
                    <View style={[styles.rule, {backgroundColor: theme.border}]} />
                    <ThemedText type="overline">{TEXT.or}</ThemedText>
                    <View style={[styles.rule, {backgroundColor: theme.border}]} />
                </View>
                <View style={styles.soon}>
                    <SoonButton testID="login-google" label={TEXT.google} />
                    <SoonButton testID="login-phone" label={TEXT.phone} />
                </View>
                <ThemedText type="footer" style={styles.footer}>
                    {TEXT.footer} <TextLink testID="login-signup-link" onPress={login.goSignup}>{TEXT.signup}</TextLink>
                </ThemedText>
            </View>
        </AuthShell>
    );
}
