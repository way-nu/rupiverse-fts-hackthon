import {Platform} from "react-native";

export const TAGLINE = "The rupee, in every form it takes in your life.";
export const SUBLINE = "One place for every account, every category, every rupee in and out.";
export const PLACE = "India · 2026";
export const FORM_MAX_WIDTH = 380;
export const WATERMARK_SIZE = 420;

// Keyboard handling on phones (Expo keyboard guide): give KeyboardAvoidingView a behavior on both platforms, because
// Expo apps are edge-to-edge on Android and the window no longer resizes for the keyboard. Web needs none.
export const KEYBOARD_BEHAVIOR = Platform.select<"padding" | "height" | undefined>({
    ios: "padding",
    android: "height",
    default: undefined,
});
export const KEYBOARD_DISMISS_MODE = Platform.select<"interactive" | "on-drag" | "none">({
    ios: "interactive",
    android: "on-drag",
    default: "none",
});
