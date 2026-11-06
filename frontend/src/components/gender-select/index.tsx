// Segmented Male / Female / Other with an "optional" hint (frontend/design/rupiverse-auth.jsx: GenderSelect).
// Each option is a radio; pressing the selected option again clears the choice.
import {Pressable, View} from "react-native";

import {ThemedText} from "@/components/themed-text";
import {useTheme} from "@/hooks/use-theme";
import type {Gender} from "@/services";

import {OPTIONS, TEXT} from "./constants";
import {styles} from "./styles";

type Props = {
    testIDPrefix: string;
    value: Gender | null;
    onChange: (value: Gender | null) => void;
    disabled?: boolean;
};

export function GenderSelect({testIDPrefix, value, onChange, disabled = false}: Props) {
    const theme = useTheme();
    return (
        <View>
            <View style={styles.labelRow}>
                <ThemedText type="label">{TEXT.label}</ThemedText>
                <ThemedText type="hint">{TEXT.optional}</ThemedText>
            </View>
            <View role="radiogroup" aria-label={TEXT.label} style={[styles.track, {backgroundColor: theme.sunken}]}>
                {OPTIONS.map((option) => {
                    const on = value === option.value;
                    return (
                        <Pressable key={option.value} testID={`${testIDPrefix}-${option.value}`} role="radio"
                            aria-checked={on} aria-disabled={disabled} disabled={disabled}
                            onPress={() => onChange(on ? null : option.value)}
                            style={[styles.option, on && [styles.selected, {backgroundColor: theme.surface}]]}>
                            <ThemedText type={on ? "segmentOn" : "segment"}>{option.label}</ThemedText>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
