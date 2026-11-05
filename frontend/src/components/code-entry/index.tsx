// The body of a code screen: error, OTP cells, "Didn't get it? Resend in m:ss" / "Resend code", submit.
import {View} from "react-native";

import {FormMessage} from "@/components/form-message";
import {OtpInput} from "@/components/otp-input";
import {PrimaryButton} from "@/components/primary-button";
import {TextLink} from "@/components/text-link";
import {ThemedText} from "@/components/themed-text";
import {formatCountdown} from "@/hooks/use-countdown";
import {type useCodeEntry} from "@/hooks/use-code-entry";

import {styles} from "./styles";

type Props = {
    testIDPrefix: string;
    submitLabel: string;
    entry: ReturnType<typeof useCodeEntry>;
};

export function CodeEntry({testIDPrefix, submitLabel, entry}: Props) {
    return (
        <View style={styles.body}>
            {entry.error && <FormMessage testID={`${testIDPrefix}-error`}>{entry.error}</FormMessage>}
            <OtpInput testIDPrefix={testIDPrefix} value={entry.code} onChange={entry.setCode} disabled={entry.locked} />
            <ThemedText type="small" style={styles.resendLine}>
                {"Didn't get it? "}
                {entry.countdown.running ? (
                    <ThemedText testID={`${testIDPrefix}-countdown`} type="small">
                        Resend in <ThemedText type="smallStrong">
                            {formatCountdown(entry.countdown.remaining)}
                        </ThemedText>
                    </ThemedText>
                ) : (
                    <TextLink testID={`${testIDPrefix}-resend`} type="small" onPress={entry.resend}>
                        Resend code
                    </TextLink>
                )}
            </ThemedText>
            <PrimaryButton testID={`${testIDPrefix}-submit`} label={submitLabel} onPress={entry.submit}
                disabled={!entry.canSubmit} busy={entry.busy} />
        </View>
    );
}
