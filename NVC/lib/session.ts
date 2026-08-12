import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { sessionSecret, db } from "./db";

const SESSION_COOKIE = "nvc_session";
const CHALLENGE_COOKIE = "nvc_challenge";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; email: string };

async function sign(payload: Record<string, unknown>, expires: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(sessionSecret());
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    return payload as T;
  } catch {
    return null;
  }
}

// ---- Full login session ----

export async function createSession(userId: string): Promise<void> {
  const token = await sign({ sub: userId }, `${SESSION_DAYS}d`);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<{ sub: string }>(token);
  if (!payload?.sub) return null;
  const user = db
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .get(payload.sub) as SessionUser | undefined;
  return user ?? null;
}

// ---- Short-lived 2FA challenge (between password check and code entry) ----

export async function createChallenge(email: string): Promise<void> {
  const token = await sign({ email, kind: "2fa" }, "10m");
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function readChallenge(): Promise<string | null> {
  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<{ email: string; kind: string }>(token);
  if (payload?.kind !== "2fa") return null;
  return payload.email ?? null;
}

export async function clearChallenge(): Promise<void> {
  (await cookies()).delete(CHALLENGE_COOKIE);
}
