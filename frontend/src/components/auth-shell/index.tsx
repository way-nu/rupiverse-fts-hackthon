// The auth frame from frontend/design/rupiverse-auth.jsx: DesktopAuth (split, web >= 1024 px) and AuthScreen (mobile).
import {type ReactNode} from "react";
import {Pressable, ScrollView, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import Svg, {Path} from "react-native-svg";

import {Logo, RupeeOrbit} from "@/components/logo";
import {useLayout} from "@/hooks/use-layout";
import {useTheme} from "@/hooks/use-theme";

import {PLACE, SUBLINE, TAGLINE, WATERMARK_SIZE} from "./constants";
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
                        <Text style={[styles.brandWord, {color: theme.accentInk}]}>Rupiverse</Text>
                    </View>
                    <View>
                        <Text style={[styles.tagline, {color: theme.accentInk}]}>{TAGLINE}</Text>
                        <Text style={[styles.subline, {color: theme.accentInk}]}>{SUBLINE}</Text>
                    </View>
                    <Text style={[styles.place, {color: theme.accentInk}]}>{PLACE}</Text>
                </View>
                <View style={styles.formColumn}>
                    <View style={styles.formInner}>
                        {onBack && (
                            <Pressable testID="auth-back" accessibilityRole="button" onPress={onBack}
                                style={styles.backLink}>
                                <Chevron color={theme.ink2} size={16} />
                                <Text style={[styles.backLinkText, {color: theme.ink2}]}>Back</Text>
                            </Pressable>
                        )}
                        {children}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <ScrollView testID="auth-layout-mobile" style={[styles.mobile, {backgroundColor: theme.page}]}
            contentContainerStyle={[styles.mobileContent, {paddingTop: insets.top, paddingBottom: insets.bottom}]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.topRow}>
                {onBack ? (
                    <Pressable testID="auth-back" accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
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
    );
}
