export const TEXT = {
    title: "Set a new password",
    subtitle: "Choose a strong password you don't use elsewhere.",
    password: "New password",
    confirm: "Confirm new password",
    submit: "Update password",
    weakPassword: "Doesn't meet the requirements below",
    tooLong: "Password is too long (max 72 bytes)",
    mismatch: "Passwords don't match",
    expired: "This reset link has expired — start again",
    restart: "Start again",
};

export const PASSWORD_ERRORS: Record<string, string> = {
    password_too_short: TEXT.weakPassword,
    password_too_weak: TEXT.weakPassword,
    password_too_long: TEXT.tooLong,
};
