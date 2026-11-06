// The auth frame from frontend/design/rupiverse-auth.jsx: DesktopAuth (split, web >= 1024 px) and AuthScreen (mobile).
import {type ReactNode} from "react";
import {KeyboardAvoidingView, Pressable, ScrollView, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import Svg, {Path} from "react-native-svg";

import {Logo, RupeeOrbit} from "@/components/logo";
import {ThemedText} from "@/components/themed-text";
import {useLayout} from "@/hooks/use-layout";
import {useTheme} from "@/hooks/use-theme";

import {KEYBOARD_BEHAVIOR, KEYBOARD_DISMISS_MODE, PLACE, SUBLINE, TAGLINE, WATERMARK_SIZE} from "./constants";
import {styles} from "./styles";

type Props = {
    children: ReactNode;
    // Flow steps (Verify, Forgot, Reset code, New password) get a back control.
    onBack?: () => void;
};

function Chevron({color, size}: { color: string; size: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 6l-6 6 6 6" />
        </Svg>
    );
}

export function AuthShell({children, onBack}: Props) {
    const theme = useTheme();
    const {isDesktopAuth} = useLayout();
    const insets = useSafeAreaInsets();

    if (isDesktopAuth) {
        return (
            <View testID="auth-layout-desktop" style={[styles.desktop, {backgroundColor: theme.page}]}>
                <View testID="auth-brand" style={[styles.brand, {backgroundColor: theme.accent}]}>
                    <View style={styles.watermark} pointerEvents="none">
                        <RupeeOrbit size={WATERMARK_SIZE} fg={theme.accentInk} />
                    </View>
                    <View style={styles.brandLogo}>
                        <RupeeOrbit size={36} fg={theme.accent} bg={theme.accentInk} radius={10} />
                        <ThemedText type="brandWord">Rupiverse</ThemedText>
                    </View>
                    <View>
                        <ThemedText type="tagline" style={styles.tagline}>{TAGLINE}</ThemedText>
                        <ThemedText type="subline" style={styles.subline}>{SUBLINE}</ThemedText>
                    </View>
                    <ThemedText type="place" style={styles.place}>{PLACE}</ThemedText>
                </View>
                <View style={styles.formColumn}>
                    <View style={styles.formInner}>
                        {onBack && (
                            <Pressable testID="auth-back" accessibilityRole="button" onPress={onBack}
                                style={styles.backLink}>
                                <Chevron color={theme.ink2} size={16} />
                                <ThemedText type="backLink">Back</ThemedText>
                            </Pressable>
                        )}
                        {children}
                    </View>
                </View>
            </View>
        );
    }

    // The keyboard shrinks the scroll area instead of covering it, so every field and the submit button stay
    // reachable while typing (PR #7 bug 3).
    return (
        <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={[styles.mobile, {backgroundColor: theme.page}]}>
            <ScrollView testID="auth-layout-mobile" style={[styles.mobile, {backgroundColor: theme.page}]}
                contentContainerStyle={[styles.mobileContent, {paddingTop: insets.top, paddingBottom: insets.bottom}]}
                keyboardShouldPersistTaps="handled" keyboardDismissMode={KEYBOARD_DISMISS_MODE}>
                <View style={styles.topRow}>
                    {onBack ? (
                        <Pressable testID="auth-back" accessibilityRole="button" accessibilityLabel="Back"
                            onPress={onBack}
                            style={[styles.backRound, {backgroundColor: theme.surface, borderWidth: 1,
                                borderColor: theme.border}]}>
                            <Chevron color={theme.ink} size={18} />
                        </Pressable>
                    ) : <View style={styles.spacer} />}
                </View>
                <View style={styles.logoRow}>
                    <Logo testID="auth-logo" size={30} />
                </View>
                <View style={styles.mobileForm}>{children}</View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
