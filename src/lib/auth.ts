import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

function getJwtSecret(): string {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

function getAuthPassword(): string {
  return process.env.AUTH_PASSWORD || "";
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = getAuthPassword();
  if (!stored) return false;
  return password === stored;
}

export function createToken(): string {
  return jwt.sign({ authenticated: true }, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return false;
  return verifyToken(token);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
