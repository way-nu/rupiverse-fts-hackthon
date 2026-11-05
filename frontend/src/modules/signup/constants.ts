export const TEXT = {
    title: "Create your account",
    subtitle: "Track every rupee across your accounts.",
    email: "Email",
    password: "Password",
    submit: "Create account",
    footer: "Already have an account?",
    login: "Log in",
    invalidEmail: "Enter a valid email address",
    weakPassword: "Doesn't meet the requirements below",
    tooLong: "Password is too long (max 72 bytes)",
    emailTaken: "An account with this email already exists.",
};

export const ERROR_TEXT: Record<string, string> = {
    email_taken: TEXT.emailTaken,
    email_send_failed: "We couldn't send the verification email. Please try again in a moment.",
};

// Server field errors, shown under the field they belong to.
export const EMAIL_ERRORS: Record<string, string> = {invalid_email: TEXT.invalidEmail};
export const PASSWORD_ERRORS: Record<string, string> = {
    password_too_short: TEXT.weakPassword,
    password_too_weak: TEXT.weakPassword,
    password_too_long: TEXT.tooLong,
};
