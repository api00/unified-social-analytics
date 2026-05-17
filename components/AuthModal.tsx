"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { authClient } from "../lib/auth-client";
import { marketingSocialBrandList, socialBrands } from "../data/socials";
import BrandLogo from "./BrandLogo";
import SocialLogo from "./SocialLogo";

type AuthModalProps = {
  authConfigured: boolean;
};

export default function AuthModal({ authConfigured }: AuthModalProps) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function continueWithGoogle() {
    setError("");

    if (!authConfigured) {
      setError("Signup is almost ready. Add the database, Better Auth, and Google env values to enable sign in.");
      return;
    }

    setIsLoading(true);
    const { error: signInError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      scopes: ["openid", "email", "profile"],
    });

    if (signInError) {
      setError(signInError.message ?? "Google sign in failed.");
      setIsLoading(false);
    }
  }

  return (
    <div
      aria-labelledby="auth-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-md"
      role="dialog"
    >
      <section className="w-full max-w-[640px] rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,0.26)] md:p-7">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <BrandLogo size={48} />
            <div>
              <strong className="block text-xl font-bold leading-tight text-slate-950">Unified</strong>
              <span className="text-sm font-semibold text-slate-500">Social Analytics</span>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <h2
            className="text-[2rem] font-bold leading-[1.08] tracking-[-0.02em] text-slate-950 md:text-[2.45rem]"
            id="auth-title"
          >
            Track every channel from one{" "}
            <span className="relative inline-block whitespace-nowrap rounded-md bg-blue-50 px-1 text-blue-700">
              clean dashboard
            </span>
            .
          </h2>
          <p className="mt-4 text-[0.98rem] leading-7 text-slate-600">
            Connect channels, see what is growing, and ask your data what to do next.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-slate-200 py-4" aria-label="Supported social networks">
          {marketingSocialBrandList.map((platform) => (
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={platform}>
              <SocialLogo className="social-logo--bare" platform={platform} size={16} />
              {socialBrands[platform].label}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600">
          <span>Channel sync</span>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <span>Performance charts</span>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <span>Growth chat</span>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <button
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(49,91,232,0.2)] transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[280px]"
            disabled={isLoading}
            onClick={continueWithGoogle}
            type="button"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <GoogleMark />}
            Continue with Google
          </button>

          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500 md:max-w-[250px]">
            <ShieldCheck className="mt-0.5 shrink-0 text-slate-400" size={15} aria-hidden="true" />
            Google signs you in. YouTube analytics is connected separately with read-only access.
          </p>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-0.9 6.7-2.4l-3.2-2.6c-.9.6-2 .9-3.5.9-2.7 0-4.9-1.8-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.3 13.7A6 6 0 0 1 6 12c0-.6.1-1.2.3-1.7V7.6H2.9a10 10 0 0 0 0 8.8l3.4-2.7Z" fill="#FBBC05" />
      <path d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2 10 10 0 0 0 2.9 7.6l3.4 2.7C7.1 7.9 9.3 6.1 12 6.1Z" fill="#EA4335" />
    </svg>
  );
}
