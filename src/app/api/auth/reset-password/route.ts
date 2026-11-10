import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ResetPasswordSchema, hashPassword, hashToken, logAudit } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de restablecimiento inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = hashToken(token);

    // Buscar token no usado y vigente
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
      await logAudit({
        action: "AUTH_RESET_PASSWORD_FAILED",
        details: { reason: "Token inválido, expirado o reutilizado" },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });

      return NextResponse.json(
        { error: "Token inválido, expirado o ya utilizado" },
        { status: 400 }
      );
    }

    // 1. Marcar token como utilizado inmediatamente (prevención de reutilización)
    await prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    });

    // 2. Hashear nueva contraseña con Argon2id y actualizar usuario
    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: newPasswordHash },
    });

    // 3. Revocar todas las sesiones activas del usuario (defensa contra robo de sesiones)
    await prisma.session.updateMany({
      where: { userId: resetRecord.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logAudit({
      action: "AUTH_RESET_PASSWORD_SUCCESS",
      userId: resetRecord.userId,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    return NextResponse.json({
      message: "Contraseña actualizada exitosamente. Inicie sesión con su nueva clave.",
    });
  } catch (err) {
    console.error("Error en reset-password:", err);
    return NextResponse.json(
      { error: "Error interno al restablecer contraseña" },
      { status: 500 }
    );
  }
}
