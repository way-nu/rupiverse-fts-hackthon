// The ₹-orbit mark and the inline "Rupiverse" lockup (frontend/design/rupiverse-theme.jsx: RupeeOrbit, Logo).
import {View, type ViewProps} from "react-native";
import Svg, {Circle, Ellipse} from "react-native-svg";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

type OrbitProps = { size: number; fg: string; bg?: string; radius?: number };

export function RupeeOrbit({size, fg, bg = "transparent", radius}: OrbitProps) {
    return (
        <View style={[styles.tile,
            {width: size, height: size, borderRadius: radius ?? size * 0.28, backgroundColor: bg}]}>
            <Svg viewBox="0 0 100 100" width={size} height={size} style={styles.svg} aria-hidden>
                <Ellipse cx="50" cy="50" rx="44" ry="19" transform="rotate(-26 50 50)" fill="none" stroke={fg}
                    strokeOpacity={0.5} strokeWidth={3.5} />
                <Circle cx="85.5" cy="31" r="6" fill={fg} />
            </Svg>
            <ThemedText type="glyph" style={{fontSize: size * 0.5, lineHeight: size * 0.5, color: fg}}>₹</ThemedText>
        </View>
    );
}

export function Logo({size = 30, ...rest}: ViewProps & { size?: number }) {
    const theme = useTheme();
    return (
        <View style={styles.inline} {...rest}>
            <RupeeOrbit size={size} fg={theme.accentInk} bg={theme.accent} />
            <ThemedText type="logoWord" style={{fontSize: size * 0.56}}>Rupiverse</ThemedText>
        </View>
    );
}
