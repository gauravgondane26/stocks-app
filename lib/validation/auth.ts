export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
