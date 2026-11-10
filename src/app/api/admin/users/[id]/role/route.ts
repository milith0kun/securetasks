import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { UpdateRoleSchema, logAudit } from "@/lib/security";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { user: currentUser } = sessionData;
    const { id } = await params;

    // Regla de seguridad: Solo administrador puede modificar roles
    if (currentUser.role !== "administrador") {
      await logAudit({
        action: "SECURITY_PRIVILEGE_ESCALATION_BLOCKED",
        userId: currentUser.id,
        details: { targetUserId: id, attempt: "PATCH_ROLE" },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });

      return NextResponse.json(
        { error: "Acceso denegado. Privilegios insuficientes para alterar roles." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = UpdateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Rol inválido", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Evita que el administrador se quite su propio rol y deje el sistema sin administradores
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: "No puede modificar su propio rol." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario objetivo no encontrado" }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await logAudit({
      action: "ADMIN_ROLE_CHANGE",
      userId: currentUser.id,
      details: {
        targetUserId: id,
        previousRole: targetUser.role,
        newRole: parsed.data.role,
      },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    return NextResponse.json({
      message: "Rol actualizado exitosamente",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error al actualizar rol:", err);
    return NextResponse.json({ error: "Error al actualizar rol" }, { status: 500 });
  }
}
