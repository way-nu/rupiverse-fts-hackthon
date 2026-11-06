// Profile (RV4 Spec §9): no Profile design exists, so it is composed from the Signup pieces (AuthField, GenderSelect,
// AuthPrimary, FormMessage) and the auth back chevron. Single centred column at every width.
import {ActivityIndicator, KeyboardAvoidingView, ScrollView, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

import {AuthField} from "@/components/auth-field";
import {BackButton} from "@/components/back-button";
import {FormMessage} from "@/components/form-message";
import {GenderSelect} from "@/components/gender-select";
import {PrimaryButton} from "@/components/primary-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";
import {ThemedView} from "@/components/themed-view";
import {useTheme} from "@/hooks/use-theme";

import {AGE_MAX_LENGTH, KEYBOARD_BEHAVIOR, NAME_MAX_LENGTH, PHONE_MAX_LENGTH, TEXT} from "./constants";
import {useProfile} from "./hooks";
import {styles} from "./styles";

export default function ProfileScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const profile = useProfile();
    const {load} = profile;
    const locked = profile.saving;
    return (
        <ThemedView style={styles.page}>
            <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.page}>
                <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled"
                    contentContainerStyle={[styles.content, {paddingTop: insets.top,
                        paddingBottom: Math.max(insets.bottom, 24)}]}>
                    <View style={styles.column}>
                        <View style={styles.topRow}>
                            <BackButton testID="profile-back" onPress={profile.back} />
                        </View>
                        <View style={styles.header}>
                            <ThemedText testID="profile-title" type="title">{TEXT.title}</ThemedText>
                        </View>
                        {load.kind === "loading" && (
                            <View testID="profile-loading" style={styles.state}>
                                <ActivityIndicator color={theme.accent} />
                            </View>
                        )}
                        {load.kind === "error" && (
                            <FormMessage testID="profile-error">
                                {TEXT.loadError}{" "}
                                <TextLink testID="profile-retry" type="small" onPress={profile.retry}>
                                    {TEXT.retry}
                                </TextLink>
                            </FormMessage>
                        )}
                        {load.kind === "ready" && (
                            <View testID="profile-screen" style={styles.form}>
                                <AuthField testID="profile-name" label={TEXT.name} value={profile.name}
                                    placeholder={TEXT.namePlaceholder} onChangeText={profile.setName}
                                    onBlur={profile.blurName} error={profile.errors.name}
                                    errorTestID="profile-name-error" maxLength={NAME_MAX_LENGTH} editable={!locked}
                                    autoComplete="name" autoCapitalize="words" />
                                <AuthField testID="profile-age" label={TEXT.age} value={profile.age}
                                    placeholder={TEXT.agePlaceholder} onChangeText={profile.setAge}
                                    onBlur={profile.blurAge} error={profile.errors.age}
                                    errorTestID="profile-age-error" maxLength={AGE_MAX_LENGTH} editable={!locked}
                                    inputMode="numeric" keyboardType="number-pad" />
                                <GenderSelect testIDPrefix="profile-gender" value={profile.gender}
                                    onChange={profile.setGender} disabled={locked} />
                                <AuthField testID="profile-phone" label={TEXT.phone} prefix={TEXT.phonePrefix}
                                    value={profile.phone} placeholder={TEXT.phonePlaceholder}
                                    onChangeText={profile.setPhone} onBlur={profile.blurPhone}
                                    error={profile.errors.phone} errorTestID="profile-phone-error"
                                    maxLength={PHONE_MAX_LENGTH} editable={!locked} inputMode="numeric"
                                    keyboardType="number-pad" autoComplete="tel-national" />
                                <AuthField testID="profile-email" label={TEXT.email} value={load.email}
                                    editable={false} selectTextOnFocus={false} />
                                {profile.saveError && (
                                    <FormMessage testID="profile-save-error">{profile.saveError}</FormMessage>
                                )}
                                <PrimaryButton testID="profile-save" label={TEXT.save} onPress={profile.save}
                                    disabled={!profile.canSave} busy={profile.saving} />
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}
