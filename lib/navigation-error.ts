import { unstable_rethrow } from "next/navigation";

// When a server action redirects, Next navigates on its own and also rejects the
// action's promise on the client with its redirect error. A caller that shows a
// toast on failure checks this first, so a successful sign-in doesn't report one.
// Rethrowing instead would make Next's global handler navigate a second time.
export const isNextNavigation = (error: unknown): boolean => {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
};
