// Home placeholder (no design; RV2 Dashboard replaces it): the /me email, Logout and the profile button (RV4).
import {ActivityIndicator, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

import {FormMessage} from "@/components/form-message";
import {Logo} from "@/components/logo";
import {PrimaryButton} from "@/components/primary-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";
import {ThemedView} from "@/components/themed-view";
import {useTheme} from "@/hooks/use-theme";

import {ProfileButton} from "./components/profile-button";
import {TEXT} from "./constants";
import {useHome} from "./hooks";
import {styles} from "./styles";

export default function HomeScreen() {
    const theme = useTheme();
    const home = useHome();
    const insets = useSafeAreaInsets();
    return (
        <ThemedView testID="home-screen" style={styles.screen}>
            <View style={[styles.topBar, {top: insets.top + 16, right: insets.right + 16}]}>
                <ProfileButton testID="home-profile" initial={home.initial} label={TEXT.profile}
                    onPress={home.openProfile} />
            </View>
            <View style={styles.card}>
                <Logo size={30} style={styles.logo} />
                {home.state.kind === "loading" && (
                    <View testID="home-loading">
                        <ActivityIndicator color={theme.accent} />
                        <ThemedText type="small" style={styles.center}>{TEXT.loading}</ThemedText>
                    </View>
                )}
                {home.state.kind === "loaded" && (
                    <ThemedText testID="home-email" type="body" style={styles.center}>
                        {TEXT.signedInAs} <ThemedText type="strong">{home.state.user.email}</ThemedText>
                    </ThemedText>
                )}
                {home.state.kind === "error" && (
                    <FormMessage testID="home-error">
                        {TEXT.error} <TextLink type="small" onPress={home.retry}>{TEXT.retry}</TextLink>
                    </FormMessage>
                )}
                <PrimaryButton testID="home-logout" label={TEXT.logout} onPress={home.logout} busy={home.leaving} />
            </View>
        </ThemedView>
    );
}
