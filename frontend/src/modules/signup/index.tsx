// Signup (design variants `signup` / `signup-invalid`, Spec §9.2): email + password only.
import {View} from "react-native";

import {AuthField} from "@/components/auth-field";
import {AuthShell} from "@/components/auth-shell";
import {FormMessage} from "@/components/form-message";
import {PasswordField} from "@/components/password-field";
import {PasswordRules} from "@/components/password-rules";
import {PrimaryButton} from "@/components/primary-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";

import {TEXT} from "./constants";
import {useSignup} from "./hooks";
import {styles} from "./styles";

export default function SignupScreen() {
    const signup = useSignup();
    return (
        <AuthShell>
            <View testID="signup-screen">
                <View style={styles.header}>
                    <ThemedText testID="signup-title" type="title">{TEXT.title}</ThemedText>
                    <ThemedText type="subtitle" style={styles.subtitle}>{TEXT.subtitle}</ThemedText>
                </View>
                <View style={styles.form}>
                    {signup.error && (
                        <FormMessage testID="signup-error">
                            {signup.error.text}
                            {signup.error.emailTaken && (
                                <>
                                    {" "}
                                    <TextLink testID="signup-error-login" type="small"
                                        onPress={signup.goLogin}>{TEXT.login}</TextLink>
                                </>
                            )}
                        </FormMessage>
                    )}
                    <AuthField testID="signup-email" label={TEXT.email} value={signup.email}
                        onChangeText={signup.setEmail} onBlur={signup.blurEmail} error={signup.emailError}
                        errorTestID="signup-email-error" valid={signup.emailValid} inputMode="email"
                        keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} />
                    <PasswordField testID="signup-password" toggleTestID="signup-password-toggle" label={TEXT.password}
                        value={signup.password} onChangeText={signup.setPassword} onBlur={signup.blurPassword}
                        error={signup.passwordError} errorTestID="signup-password-error" autoComplete="new-password"
                        below={<PasswordRules value={signup.password} testIDPrefix="signup" />}
                        onSubmitEditing={signup.submit} />
                    <PrimaryButton testID="signup-submit" label={TEXT.submit} onPress={signup.submit}
                        disabled={!signup.canSubmit} busy={signup.busy} />
                </View>
                <ThemedText type="footer" style={styles.footer}>
                    {TEXT.footer} <TextLink testID="signup-login-link" onPress={signup.goLogin}>{TEXT.login}</TextLink>
                </ThemedText>
            </View>
        </AuthShell>
    );
}
