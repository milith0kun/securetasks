import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LoginSchema,
  verifyPassword,
  checkRateLimit,
  recordLoginAttempt,
  logAudit,
} from "@/lib/security";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/session";

export async function POST(req: Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de acceso inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verificación de fuerza bruta y límite de intentos
    const rateLimit = await checkRateLimit(ipAddress, normalizedEmail);
    if (!rateLimit.allowed) {
      await logAudit({
        action: "AUTH_BRUTE_FORCE_BLOCKED",
        details: { email: normalizedEmail, retryAfter: rateLimit.retryAfterSeconds },
        ipAddress,
      });

      return NextResponse.json(
        {
          error: "Demasiados intentos fallidos. Cuenta temporalmente bloqueada.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.retryAfterSeconds.toString(),
          },
        }
      );
    }

    // 2. Búsqueda de usuario y verificación segura con Argon2id
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await recordLoginAttempt(ipAddress, normalizedEmail, false);
      await logAudit({
        action: "AUTH_LOGIN_FAIL",
        details: { email: normalizedEmail, reason: "Usuario no encontrado" },
        ipAddress,
      });

      return NextResponse.json(
        { error: "Credenciales de acceso inválidas", remainingAttempts: rateLimit.remainingAttempts - 1 },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      await recordLoginAttempt(ipAddress, normalizedEmail, false);
      await logAudit({
        action: "AUTH_LOGIN_FAIL",
        userId: user.id,
        details: { email: normalizedEmail, reason: "Contraseña incorrecta" },
        ipAddress,
      });

      return NextResponse.json(
        { error: "Credenciales de acceso inválidas", remainingAttempts: rateLimit.remainingAttempts - 1 },
        { status: 401 }
      );
    }

    // 3. Inicio exitoso: registrar intento válido y crear sesión
    await recordLoginAttempt(ipAddress, normalizedEmail, true);
    const sessionToken = await createSession(user.id, req);

    await logAudit({
      action: "AUTH_LOGIN_SUCCESS",
      userId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress,
    });

    const response = NextResponse.json({
      message: "Inicio de sesión exitoso",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 3600,
    });

    return response;
  } catch (err) {
    console.error("Error en login:", err);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el inicio de sesión" },
      { status: 500 }
    );
  }
}
