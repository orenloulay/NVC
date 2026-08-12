"use client";

import { useState } from "react";
import Logo from "../components/Logo";

type Lang = "en" | "he";

const copy = {
  en: {
    dir: "ltr" as const,
    tagline: "Nonviolent Communication",
    subtitle: "A calmer space to be heard — and to hear.",
    signIn: "Sign in",
    register: "Create account",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Your password",
    pwGuide:
      "At least 10 characters, with an uppercase letter, a number, and a symbol.",
    twoFa: "Protected with two-factor authentication.",
    continue: "Continue",
    noAccount: "New here?",
    haveAccount: "Already have an account?",
    langLabel: "עברית",
  },
  he: {
    dir: "rtl" as const,
    tagline: "תקשורת מקרבת",
    subtitle: "מרחב רגוע יותר להישמע — וגם להקשיב.",
    signIn: "כניסה",
    register: "יצירת חשבון",
    email: "אימייל",
    emailPlaceholder: "you@example.com",
    password: "סיסמה",
    passwordPlaceholder: "הסיסמה שלך",
    pwGuide: "לפחות 10 תווים, עם אות גדולה, מספר וסימן.",
    twoFa: "מאובטח באמצעות אימות דו-שלבי.",
    continue: "המשך",
    noAccount: "חדשים כאן?",
    haveAccount: "כבר יש לך חשבון?",
    langLabel: "English",
  },
};

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<"signIn" | "register">("signIn");
  const t = copy[lang];

  return (
    <main
      dir={t.dir}
      className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4 py-12 dark:from-neutral-950 dark:to-neutral-900"
    >
      <div className="w-full max-w-sm">
        {/* Language toggle */}
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setLang((l) => (l === "en" ? "he" : "en"))}
            className="rounded-full border border-teal-200 px-3 py-1 text-sm text-teal-700 transition hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-neutral-800"
          >
            {t.langLabel}
          </button>
        </div>

        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">NVC</h1>
          <p className="mt-1 text-sm font-medium text-teal-700 dark:text-teal-300">
            {t.tagline}
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t.subtitle}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          {/* Mode tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            {(["signIn", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === m
                    ? "bg-white text-teal-700 shadow-sm dark:bg-neutral-900 dark:text-teal-300"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                }`}
              >
                {m === "signIn" ? t.signIn : t.register}
              </button>
            ))}
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t.email}</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder={t.emailPlaceholder}
                className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-neutral-700"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t.password}</span>
              <input
                type="password"
                required
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
                placeholder={t.passwordPlaceholder}
                className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-neutral-700"
              />
              {mode === "register" && (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t.pwGuide}
                </span>
              )}
            </label>

            <button
              type="submit"
              className="mt-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              {t.continue}
            </button>
          </form>

          {/* 2FA note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{t.twoFa}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
