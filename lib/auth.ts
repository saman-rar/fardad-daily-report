import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SafeUser } from "@/lib/types";

const COOKIE_NAME = "fardad_session";

function secret() {
  const value = process.env.AUTH_SECRET || "development-secret-change-me-development";
  return new TextEncoder().encode(value);
}

export async function createSession(user: SafeUser) {
  const token = await new SignJWT({
    sub: user.id,
    name: user.fullName,
    username: user.username,
    role: user.role,
    status: user.status,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.sub),
      fullName: String(payload.name),
      username: String(payload.username),
      role: payload.role as SafeUser["role"],
      status: payload.status as SafeUser["status"],
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}
