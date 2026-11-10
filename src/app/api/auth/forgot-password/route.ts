import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForgotPasswordSchema, generateSecureToken, logAudit } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Correo electronico invalido" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
    });

    let tokenPreview: string | null = null;

    if (user) {
      // 1. Invalidar tokens anteriores activos para este usuario (Seguridad: un solo token activo)
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // 2. Generar token criptográfico aleatorio y almacenar su HASH SHA-256
      const { token, hash } = generateSecureToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      await prisma.passwordResetToken.create({
        data: {
          tokenHash: hash,
          userId: user.id,
          expiresAt,
        },
      });

      tokenPreview = token;

      await logAudit({
        action: "AUTH_FORGOT_PASSWORD_REQUEST",
        userId: user.id,
        details: { email },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });
    }

    // Mensaje genérico para evitar enumeración de usuarios
    return NextResponse.json({
      message: "Si el correo se encuentra registrado, se enviara un enlace con instrucciones.",
      // En entorno de demostración y pruebas, se retorna el token para facilitar la verificación automatizada
      resetToken: process.env.NODE_ENV !== "production" ? tokenPreview : undefined,
    });
  } catch (err) {
    console.error("Error en forgot-password:", err);
    return NextResponse.json({ error: "Error interno al procesar solicitud" }, { status: 500 });
  }
}
