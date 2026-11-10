import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { user } = sessionData;

    // Solo el administrador tiene permiso de listar usuarios
    if (user.role !== "administrador") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren privilegios de administrador." },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Error al listar usuarios:", err);
    return NextResponse.json({ error: "Error interno al consultar usuarios" }, { status: 500 });
  }
}
