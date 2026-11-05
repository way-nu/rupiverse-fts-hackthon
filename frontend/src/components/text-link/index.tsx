import {type TextProps} from "react-native";

import {ThemedText, type ThemedTextType} from "@/components/themed-text";

type Props = TextProps & { onPress: () => void; type?: ThemedTextType };

// An inline accent link; nests inside a ThemedText line.
export function TextLink({type = "link", ...rest}: Props) {
    return <ThemedText type={type} tone="accent" accessibilityRole="link" suppressHighlighting {...rest} />;
}
