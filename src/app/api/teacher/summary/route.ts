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

    // Regla de autorización: Solo docente o administrador pueden consultar el resumen
    if (user.role !== "docente" && user.role !== "administrador") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requiere rol de docente o administrador." },
        { status: 403 }
      );
    }

    // Estadísticas propias del docente
    const myTasksCount = await prisma.task.count({ where: { userId: user.id } });
    const myCompleted = await prisma.task.count({ where: { userId: user.id, status: "completada" } });
    const myPending = await prisma.task.count({ where: { userId: user.id, status: "pendiente" } });
    const myInProgress = await prisma.task.count({ where: { userId: user.id, status: "en_progreso" } });

    // Estadísticas globales de estudiantes
    const totalStudents = await prisma.user.count({ where: { role: "estudiante" } });
    const studentTasks = await prisma.task.groupBy({
      by: ["status"],
      where: {
        user: { role: "estudiante" },
      },
      _count: true,
    });

    const studentStats = {
      totalTasks: 0,
      pendiente: 0,
      en_progreso: 0,
      completada: 0,
    };

    for (const group of studentTasks) {
      studentStats[group.status] = group._count;
      studentStats.totalTasks += group._count;
    }

    return NextResponse.json({
      teacher: {
        id: user.id,
        name: user.name,
        myTasks: {
          total: myTasksCount,
          pendiente: myPending,
          en_progreso: myInProgress,
          completada: myCompleted,
        },
      },
      studentsMetrics: {
        totalStudents,
        ...studentStats,
      },
    });
  } catch (err) {
    console.error("Error al obtener resumen de docente:", err);
    return NextResponse.json({ error: "Error interno al consultar resumen" }, { status: 500 });
  }
}
