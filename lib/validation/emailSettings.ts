import type { EmailSettings } from "@/lib/email-settings";

// Server actions are public endpoints, so the input is checked even though the
// form only sends booleans.
export const validateEmailSettings = (
  input: unknown,
): { valid: true; data: EmailSettings } | { valid: false; error: string } => {
  const raw = (input ?? {}) as Record<string, unknown>;
  if (typeof raw.digest !== "boolean" || typeof raw.alerts !== "boolean") {
    return { valid: false, error: "Couldn't read your email settings. Please try again." };
  }
  return { valid: true, data: { digest: raw.digest, alerts: raw.alerts } };
};
