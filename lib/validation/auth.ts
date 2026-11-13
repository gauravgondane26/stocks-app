export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// react-hook-form rules shared by the auth forms. The server actions check the same
// limits again below, because a form can be skipped.
export const EMAIL_FIELD_RULES = {
  required: "Enter your email",
  pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address" },
};

export const newPasswordRules = (requiredMessage: string) => ({
  required: requiredMessage,
  minLength: {
    value: PASSWORD_MIN_LENGTH,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  },
  maxLength: {
    value: PASSWORD_MAX_LENGTH,
    message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  },
});

// `password` reads the other field at submit time.
export const confirmPasswordRules = (password: () => string) => ({
  required: "Type the password again",
  validate: (value: string) => value === password() || "Passwords don't match",
});

type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";


const validateCredentials = (email: string, password: string): string | null => {
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
};

// Server actions are public endpoints, so input is checked here even though the
// forms already validate it.
export const validateSignUp = (
  input: unknown,
): ValidationResult<SignUpFormData> => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const data: SignUpFormData = {
    fullName: asString(raw.fullName).trim(),
    email: asString(raw.email).trim().toLowerCase(),
    password: asString(raw.password),
  };

  if (!data.fullName) return { valid: false, error: "Enter your full name." };
  if (data.fullName.length > NAME_MAX_LENGTH) {
    return { valid: false, error: "Name is too long." };
  }

  const credentialsError = validateCredentials(data.email, data.password);
  if (credentialsError) return { valid: false, error: credentialsError };

  return { valid: true, data };
};

export const validateSignIn = (
  input: unknown,
): ValidationResult<SignInFormData> => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const data: SignInFormData = {
    email: asString(raw.email).trim().toLowerCase(),
    password: asString(raw.password),
  };

  if (!EMAIL_PATTERN.test(data.email) || !data.password) {
    return { valid: false, error: "Enter your email and password." };
  }
  if (data.password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: "Invalid email or password." };
  }

  return { valid: true, data };
};

export const validatePasswordResetRequest = (
  input: unknown,
): ValidationResult<{ email: string }> => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const email = asString(raw.email).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { valid: false, error: "Enter a valid email address." };
  return { valid: true, data: { email } };
};

const TOKEN_MAX_LENGTH = 200;

export const validatePasswordReset = (
  input: unknown,
): ValidationResult<{ token: string; password: string }> => {
  const raw = (input ?? {}) as Record<string, unknown>;
  const token = asString(raw.token);
  const password = asString(raw.password);
  if (!token || token.length > TOKEN_MAX_LENGTH) {
    return { valid: false, error: "This reset link isn't valid. Ask for a new one." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  return { valid: true, data: { token, password } };
};
