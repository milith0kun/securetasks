import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { TaskCreateSchema, logAudit } from "@/lib/security";
import { TaskStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { user } = sessionData;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") as TaskStatus | null;

    // Regla de autorización e IDOR:
    // Estudiante y Docente solo acceden a sus tareas propias.
    // Administrador puede auditar y listar todas las tareas del sistema.
    const whereClause: Record<string, unknown> = {};

    if (user.role !== "administrador") {
      whereClause.userId = user.id;
    }

    if (status && ["pendiente", "en_progreso", "completada"].includes(status)) {
      whereClause.status = status;
    }

    if (search.trim()) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Error al listar tareas:", err);
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { user } = sessionData;
    const body = await req.json();
    const parsed = TaskCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de tarea invalidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { title, description, status } = parsed.data;

    // Se asigna automáticamente el dueño autenticado (garantía anti-IDOR)
    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status as TaskStatus,
        userId: user.id,
      },
    });

    await logAudit({
      action: "TASK_CREATE",
      userId: user.id,
      details: { taskId: task.id, title: task.title },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    return NextResponse.json({ message: "Tarea creada correctamente", task }, { status: 201 });
  } catch (err) {
    console.error("Error al crear tarea:", err);
    return NextResponse.json({ error: "Error al registrar tarea" }, { status: 500 });
  }
}
