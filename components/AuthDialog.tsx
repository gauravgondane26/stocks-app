"use client";

import { useEffect, useState } from "react";

import SignInForm from "@/components/forms/SignInForm";
import SignUpForm from "@/components/forms/SignUpForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OPEN_AUTH_EVENT, type AuthMode, type OpenAuthDetail } from "@/lib/auth-events";
import { safeNextPath } from "@/lib/auth-path";

const COPY: Record<AuthMode, { title: string; description: string }> = {
  "sign-in": {
    title: "Welcome back",
    description: "Sign in to keep a watchlist, set alerts and save your trade settings.",
  },
  "sign-up": {
    title: "Create your account",
    description: "It's free. Keep a watchlist, set alerts and save your trade settings.",
  },
};

// Sign-in and sign-up over the page a guest is on, opened with openAuth(). Signing
// in reloads that page (or `next`) with the session, and the header then drops
// this dialog. Mounted once, in the header, only for guests.
const AuthDialog = () => {
  const [open, setOpen] = useState(false);
  // Kept after closing so the content doesn't vanish during the close animation.
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [next, setNext] = useState("/");

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenAuthDetail>).detail;
      setMode(detail.mode);
      setNext(safeNextPath(detail.next ?? window.location.pathname));
      setOpen(true);
    };
    window.addEventListener(OPEN_AUTH_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_AUTH_EVENT, handleOpen);
  }, []);

  const { title, description } = COPY[mode];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        overlayClassName="bg-black/60 supports-backdrop-filter:backdrop-blur-sm"
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto [scrollbar-color:var(--color-gray-600)_transparent] [scrollbar-width:thin] bg-gray-800 p-6 text-gray-400 ring-gray-600 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-100">{title}</DialogTitle>
          <DialogDescription className="text-gray-500">{description}</DialogDescription>
        </DialogHeader>
        {/* Keyed so switching forms starts the new one empty. */}
        {mode === "sign-in" ? (
          <SignInForm key="sign-in" next={next} onSwitch={() => setMode("sign-up")} />
        ) : (
          <SignUpForm key="sign-up" next={next} onSwitch={() => setMode("sign-in")} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
