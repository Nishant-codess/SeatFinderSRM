"use client";

// OTP-only auth: all auth flows go through /api/auth/* server routes.
// Tokens are stored in localStorage; no passwords are ever set or used.

const LS_PREFIX = "seatfinder_";
const KEY_ACCESS = `${LS_PREFIX}access_token`;
const KEY_EMAIL  = `${LS_PREFIX}email`;
const KEY_UID    = `${LS_PREFIX}uid`;
const KEY_ADMIN  = `${LS_PREFIX}is_admin`;

export interface AppUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  accessToken: string;
  isAdmin: boolean;
}

export interface SessionTokens {
  accessToken: string;
  email: string;
  userId: string;
  isAdmin: boolean;
}

export function storeSession(tokens: SessionTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_ACCESS, tokens.accessToken);
  localStorage.setItem(KEY_EMAIL,  tokens.email);
  localStorage.setItem(KEY_UID,    tokens.userId);
  localStorage.setItem(KEY_ADMIN,  String(tokens.isAdmin));
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // exp is in seconds; give a 30s buffer
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

export function getCurrentUser(): Promise<AppUser | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const accessToken = localStorage.getItem(KEY_ACCESS);
  const email       = localStorage.getItem(KEY_EMAIL);
  const uid         = localStorage.getItem(KEY_UID);
  const isAdmin     = localStorage.getItem(KEY_ADMIN) === "true";

  if (!accessToken || !uid) return Promise.resolve(null);

  // Token expired — clear storage so user is redirected to login
  if (isJwtExpired(accessToken)) {
    signOut();
    return Promise.resolve(null);
  }

  return Promise.resolve({ uid, email, emailVerified: true, accessToken, isAdmin });
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_ACCESS);
  localStorage.removeItem(KEY_EMAIL);
  localStorage.removeItem(KEY_UID);
  localStorage.removeItem(KEY_ADMIN);
}
