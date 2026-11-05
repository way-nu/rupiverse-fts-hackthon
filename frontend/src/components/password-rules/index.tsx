// The live password checklist (Spec §9): 8+ characters, 1 uppercase, 1 lowercase, 1 number, 1 special char.
import {View} from "react-native";
import Svg, {Circle, Path} from "react-native-svg";

import {ThemedText} from "@/components/themed-text";
import {PASSWORD_RULES, passwordChecks} from "@/hooks/use-validation";
import {useTheme} from "@/hooks/use-theme";

import {styles} from "./styles";

export function PasswordRules({value, testIDPrefix}: { value: string; testIDPrefix: string }) {
    const theme = useTheme();
    const checks = passwordChecks(value);
    return (
        <View testID={`${testIDPrefix}-rules`} style={styles.list}>
            {PASSWORD_RULES.map((rule) => {
                const ok = checks[rule.key];
                return (
                    <View key={rule.key} testID={`${testIDPrefix}-rule-${rule.key}`} role="checkbox" aria-checked={ok}
                        style={styles.item}>
                        <Svg width={13} height={13} viewBox="0 0 14 14" fill="none"
                            stroke={ok ? theme.positive : theme.ink3} strokeWidth={ok ? 2.2 : 1.8}
                            strokeLinecap="round" strokeLinejoin="round">
                            {ok ? <Path d="M2.5 7.5l2.5 2.5 6.5-6.5" /> : <Circle cx={7} cy={7} r={5} />}
                        </Svg>
                        <ThemedText type="small" tone={ok ? "ink2" : "ink3"}>{rule.label}</ThemedText>
                    </View>
                );
            })}
        </View>
    );
}
