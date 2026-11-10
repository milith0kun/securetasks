import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { generateSecureToken, hashToken } from "./security";
import { Role, User } from "@prisma/client";

export const SESSION_COOKIE_NAME = "securetasks_session";
export const SESSION_DURATION_HOURS = 24;

export async function createSession(userId: string, req?: Request): Promise<string> {
  const { token, hash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  if (req) {
    ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    userAgent = req.headers.get("user-agent") || null;
  }

  await prisma.session.create({
    data: {
      tokenHash: hash,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return token;
}

export async function getSessionUser(token?: string): Promise<{
  user: User;
  sessionId: string;
} | null> {
  let sessionToken = token;

  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // In non-cookie contexts
    }
  }

  if (!sessionToken) return null;

  const tokenHash = hashToken(sessionToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  // Verificar si la sesión fue revocada
  if (session.revokedAt) return null;

  // Verificar si la sesión expiró
  if (session.expiresAt < new Date()) return null;

  return {
    user: session.user,
    sessionId: session.id,
  };
}

export async function revokeSession(token?: string): Promise<boolean> {
  let sessionToken = token;

  if (!sessionToken) {
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      //
    }
  }

  if (!sessionToken) return false;

  const tokenHash = hashToken(sessionToken);

  const updated = await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return updated.count > 0;
}

export function authorizeRole(user: User, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(user.role);
}
