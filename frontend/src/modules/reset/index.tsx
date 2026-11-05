// New password (design variant `reset`, Spec §9.6).
import {Redirect} from "expo-router";
import {View} from "react-native";

import {AuthShell} from "@/components/auth-shell";
import {FormMessage} from "@/components/form-message";
import {PasswordField} from "@/components/password-field";
import {PasswordRules} from "@/components/password-rules";
import {PrimaryButton} from "@/components/primary-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";

import {TEXT} from "./constants";
import {useReset} from "./hooks";
import {styles} from "./styles";

export default function ResetScreen() {
    const reset = useReset();
    if (!reset.hasGrant) {
        return <Redirect href="/forgot" />;
    }
    return (
        <AuthShell onBack={reset.back}>
            <View testID="reset-screen">
                <View style={styles.header}>
                    <ThemedText type="title">{TEXT.title}</ThemedText>
                    <ThemedText type="subtitle" style={styles.subtitle}>{TEXT.subtitle}</ThemedText>
                </View>
                <View style={styles.form}>
                    {reset.error && (
                        <FormMessage testID="reset-error">
                            {reset.error.text}
                            {reset.error.expired && (
                                <>
                                    {". "}
                                    <TextLink testID="reset-restart" type="small"
                                        onPress={reset.restart}>{TEXT.restart}</TextLink>
                                </>
                            )}
                        </FormMessage>
                    )}
                    <PasswordField testID="reset-password" toggleTestID="reset-password-toggle" label={TEXT.password}
                        value={reset.password} onChangeText={reset.setPassword} onBlur={reset.blurPassword}
                        error={reset.passwordError} errorTestID="reset-password-error" autoComplete="new-password"
                        below={<PasswordRules value={reset.password} testIDPrefix="reset" />} />
                    <PasswordField testID="reset-confirm" toggleTestID="reset-confirm-toggle" label={TEXT.confirm}
                        value={reset.confirm} onChangeText={reset.setConfirm} onBlur={reset.blurConfirm}
                        error={reset.confirmError} errorTestID="reset-confirm-error" autoComplete="new-password"
                        onSubmitEditing={reset.submit} />
                    <PrimaryButton testID="reset-submit" label={TEXT.submit} onPress={reset.submit}
                        disabled={!reset.canSubmit} busy={reset.busy} />
                </View>
            </View>
        </AuthShell>
    );
}
