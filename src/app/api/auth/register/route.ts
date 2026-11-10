import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegisterSchema, hashPassword, logAudit } from "@/lib/security";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de registro inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Comprobar si el usuario ya existe
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "El correo electrónico ya se encuentra registrado" },
        { status: 409 }
      );
    }

    // Regla de seguridad: El registro público siempre asigna el rol estudiante
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: "estudiante",
      },
    });

    // Iniciar sesión automáticamente
    const sessionToken = await createSession(user.id, req);

    await logAudit({
      action: "AUTH_REGISTER",
      userId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    const response = NextResponse.json(
      {
        message: "Usuario registrado exitosamente",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );

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
    console.error("Error en registro:", err);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el registro" },
      { status: 500 }
    );
  }
}
