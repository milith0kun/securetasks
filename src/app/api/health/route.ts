import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Comprueba que la aplicación tiene DATABASE_URL y que PostgreSQL responde.
// No expone credenciales ni detalles internos del error.
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: "error", database: "DATABASE_URL no definida" }, { status: 503 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "conectada" });
  } catch (err) {
    console.error("Health check: fallo de conexión a la base de datos:", err);
    return NextResponse.json({ status: "error", database: "sin conexión" }, { status: 503 });
  }
}
