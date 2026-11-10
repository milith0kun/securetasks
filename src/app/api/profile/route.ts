import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ChangePasswordSchema, hashPassword, verifyPassword, logAudit } from "@/lib/security";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { user } = sessionData;
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Error al obtener perfil:", err);
    return NextResponse.json({ error: "Error al obtener perfil" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { user } = sessionData;
    const body = await req.json();

    // 1. Caso cambio de contraseña
    if (body.currentPassword && body.newPassword) {
      const parsed = ChangePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Datos de contraseña inválidos", details: parsed.error.format() },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
      if (!isValid) {
        return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
      }

      const newHash = await hashPassword(parsed.data.newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      await logAudit({
        action: "AUTH_CHANGE_PASSWORD_SUCCESS",
        userId: user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });

      return NextResponse.json({ message: "Contraseña modificada correctamente" });
    }

    // 2. Caso actualización de datos básicos
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name || user.name },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ message: "Perfil actualizado correctamente", user: updated });
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
    return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
  }
}
