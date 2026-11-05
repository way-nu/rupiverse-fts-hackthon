// Password input with the eye toggle, an optional "Forgot?" link and an optional rules checklist.
import {type ReactNode} from "react";
import {Pressable} from "react-native";
import Svg, {Circle, Path} from "react-native-svg";

import {AuthField, type AuthFieldProps} from "@/components/auth-field";
import {useTheme} from "@/hooks/use-theme";

import {usePasswordReveal} from "./hooks";
import {styles} from "./styles";

type Props = Omit<AuthFieldProps, "rightSlot" | "secureTextEntry"> & {
    toggleTestID?: string;
    forgot?: ReactNode;
};

export function PasswordField({toggleTestID, forgot, ...field}: Props) {
    const theme = useTheme();
    const {revealed, toggle} = usePasswordReveal();
    const eye = (
        <Pressable testID={toggleTestID} accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"} onPress={toggle} style={styles.eye}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.ink3} strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round">
                <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <Circle cx={12} cy={12} r={3} />
                {!revealed && <Path d="M3 3l18 18" />}
            </Svg>
        </Pressable>
    );
    return (
        <AuthField {...field} labelRight={forgot} secureTextEntry={!revealed} autoCapitalize="none"
            autoCorrect={false} rightSlot={eye} />
    );
}
