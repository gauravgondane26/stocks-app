export type AuthMode = "sign-in" | "sign-up";
export type OpenAuthDetail = { mode: AuthMode; next?: string };

// For guests, one sign-in dialog lives in the header, like the search dialog.
// Anything that needs an account opens it with this event. `next` is where to go
// after signing in, and defaults to the page the guest is on.
export const OPEN_AUTH_EVENT = "openwatch:open-auth";

export const openAuth = (mode: AuthMode = "sign-in", next?: string) => {
  window.dispatchEvent(
    new CustomEvent<OpenAuthDetail>(OPEN_AUTH_EVENT, { detail: { mode, next } }),
  );
};
