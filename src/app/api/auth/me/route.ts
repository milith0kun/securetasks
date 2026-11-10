import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    const sessionData = await getSessionUser();

    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado. Sesión no valida o expirada" }, { status: 401 });
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
    console.error("Error en /api/auth/me:", err);
    return NextResponse.json({ error: "Error interno al consultar perfil" }, { status: 500 });
  }
}
