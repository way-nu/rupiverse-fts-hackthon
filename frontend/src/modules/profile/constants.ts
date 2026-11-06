import {AGE_MAX_DIGITS, NAME_MAX, PHONE_DIGITS} from "@/hooks/use-validation";

export const TEXT = {
    title: "Profile",
    name: "Name",
    namePlaceholder: "Your full name",
    age: "Age",
    agePlaceholder: "18+",
    phone: "Phone",
    phonePrefix: "+91",
    phonePlaceholder: "98765 43210",
    email: "Email",
    save: "Save",
    loadError: "Couldn't load your profile.",
    retry: "Retry",
    // Field messages from the design's `signup-invalid` variant, plus the PM's age > 120 text (Spec §9).
    nameShort: "Name must be at least 3 characters",
    ageUnder: "You must be 18 or older",
    ageInvalid: "Enter a valid age",
    phoneInvalid: "Enter a valid 10-digit number",
};

// Save errors → friendly text (Spec §9). Anything not listed is "Couldn't save. Try again."
export const SAVE_ERROR_TEXT: Record<string, string> = {
    invalid_profile: "Some details aren't valid. Check the highlighted fields.",
};
export const SAVE_FAILED_TEXT = "Couldn't save. Try again.";

export const NAME_MAX_LENGTH = NAME_MAX;
export const AGE_MAX_LENGTH = AGE_MAX_DIGITS;
// 10 digits plus the display space ("98765 43210").
export const PHONE_MAX_LENGTH = PHONE_DIGITS + 1;
export const PHONE_GROUP = 5;

// Same single centred column as the auth forms (design: AuthScreen / DesktopAuth form width).
export const FORM_MAX_WIDTH = 380;
export {KEYBOARD_BEHAVIOR} from "@/components/auth-shell/constants";
