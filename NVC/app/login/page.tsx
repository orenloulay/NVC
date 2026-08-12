"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../components/Logo";

type Lang = "en" | "he";
type Mode = "signIn" | "register";
type Step = "credentials" | "code";

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
    pwGuide: "At least 10 characters, with an uppercase letter, a number, and a symbol.",
    twoFa: "Protected with two-factor authentication.",
    continue: "Continue",
    codeTitle: "Enter your code",
    codeSentTo: (e: string) => `We emailed a 6-digit code to ${e}.`,
    codePlaceholder: "123456",
    verify: "Verify",
    resend: "Resend code",
    resent: "A new code is on its way.",
    back: "Back",
    working: "Please wait…",
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
    codeTitle: "הזינו את הקוד",
    codeSentTo: (e: string) => `שלחנו קוד בן 6 ספרות לכתובת ${e}.`,
    codePlaceholder: "123456",
    verify: "אימות",
    resend: "שליחת קוד מחדש",
    resent: "קוד חדש בדרך.",
    back: "חזרה",
    working: "רגע…",
    langLabel: "English",
  },
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: Record<string, unknown> };
}

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<Mode>("signIn");
  const [step, setStep] = useState<Step>("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Which code flow are we in: 'verify' (new account) or 'login' (2FA).
  const [codePurpose, setCodePurpose] = useState<"verify" | "login">("login");

  const t = copy[lang];

  function reset() {
    setStep("credentials");
    setCode("");
    setError(null);
    setNotice(null);
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const url = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const { ok, data } = await postJson(url, { email, password });
    setBusy(false);
    if (!ok) {
      setError((data.error as string) ?? "Something went wrong.");
      return;
    }
    if (data.needs2fa) {
      setCodePurpose("login");
      setStep("code");
    } else if (data.needsVerification) {
      setCodePurpose("verify");
      setStep("code");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const url = codePurpose === "verify" ? "/api/auth/verify" : "/api/auth/login/verify";
    const { ok, data } = await postJson(url, { email, code });
    setBusy(false);
    if (!ok) {
      setError((data.error as string) ?? "Something went wrong.");
      return;
    }
    router.push("/app");
  }

  async function resend() {
    setError(null);
    setNotice(null);
    await postJson("/api/auth/resend", { email, purpose: codePurpose });
    setNotice(t.resent);
  }

  const inputClass =
    "rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-neutral-700";

  return (
    <main
      dir={t.dir}
      className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4 py-12 dark:from-neutral-950 dark:to-neutral-900"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setLang((l) => (l === "en" ? "he" : "en"))}
            className="rounded-full border border-teal-200 px-3 py-1 text-sm text-teal-700 transition hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-neutral-800"
          >
            {t.langLabel}
          </button>
        </div>

        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">NVC</h1>
          <p className="mt-1 text-sm font-medium text-teal-700 dark:text-teal-300">{t.tagline}</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t.subtitle}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          {step === "credentials" && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                {(["signIn", "register"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      reset();
                    }}
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

              <form className="flex flex-col gap-4" onSubmit={submitCredentials}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t.email}</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t.password}</span>
                  <input
                    type="password"
                    required
                    autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className={inputClass}
                  />
                  {mode === "register" && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{t.pwGuide}</span>
                  )}
                </label>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-60"
                >
                  {busy ? t.working : t.continue}
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>{t.twoFa}</span>
              </div>
            </>
          )}

          {step === "code" && (
            <form className="flex flex-col gap-4" onSubmit={submitCode}>
              <div>
                <h2 className="text-lg font-semibold">{t.codeTitle}</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {t.codeSentTo(email)}
                </p>
              </div>

              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t.codePlaceholder}
                className={`${inputClass} text-center text-lg tracking-[0.4em]`}
              />

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {notice && <p className="text-sm text-teal-600 dark:text-teal-400">{notice}</p>}

              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-60"
              >
                {busy ? t.working : t.verify}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={reset} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400">
                  {t.back}
                </button>
                <button type="button" onClick={resend} className="text-teal-700 hover:underline dark:text-teal-300">
                  {t.resend}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
