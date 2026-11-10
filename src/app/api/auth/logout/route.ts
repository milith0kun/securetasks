import { NextResponse } from "next/server";
import { getSessionUser, revokeSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { logAudit } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();

    if (sessionData) {
      await revokeSession();
      await logAudit({
        action: "AUTH_LOGOUT",
        userId: sessionData.user.id,
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });
    }

    const response = NextResponse.json({ message: "Sesion cerrada correctamente" });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("Error en logout:", err);
    return NextResponse.json({ error: "Error al cerrar sesion" }, { status: 500 });
  }
}
