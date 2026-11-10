import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { TaskUpdateSchema, logAudit } from "@/lib/security";
import { TaskStatus } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { user } = sessionData;

    const task = await prisma.task.findUnique({
      where: { id },
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
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Comprobación estricta contra IDOR (Insecure Direct Object Reference)
    if (user.role !== "administrador" && task.userId !== user.id) {
      await logAudit({
        action: "SECURITY_IDOR_BLOCKED",
        userId: user.id,
        details: { targetTaskId: id, ownerUserId: task.userId, attempt: "GET" },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });

      return NextResponse.json(
        { error: "Acceso denegado. No tiene permisos sobre esta tarea." },
        { status: 403 }
      );
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error("Error al consultar tarea:", err);
    return NextResponse.json({ error: "Error al consultar tarea" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { user } = sessionData;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Comprobación IDOR en actualización
    if (user.role !== "administrador" && task.userId !== user.id) {
      await logAudit({
        action: "SECURITY_IDOR_BLOCKED",
        userId: user.id,
        details: { targetTaskId: id, ownerUserId: task.userId, attempt: "PUT" },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });

      return NextResponse.json(
        { error: "Acceso denegado. No tiene autorizacion para modificar esta tarea." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = TaskUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos de actualizacion invalidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status as TaskStatus;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      action: "TASK_UPDATE",
      userId: user.id,
      details: { taskId: id, changes: updateData },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    return NextResponse.json({ message: "Tarea actualizada exitosamente", task: updatedTask });
  } catch (err) {
    console.error("Error al actualizar tarea:", err);
    return NextResponse.json({ error: "Error al actualizar tarea" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { user } = sessionData;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Comprobación IDOR en eliminación
    if (user.role !== "administrador" && task.userId !== user.id) {
      await logAudit({
        action: "SECURITY_IDOR_BLOCKED",
        userId: user.id,
        details: { targetTaskId: id, ownerUserId: task.userId, attempt: "DELETE" },
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      });

      return NextResponse.json(
        { error: "Acceso denegado. No tiene autorizacion para eliminar esta tarea." },
        { status: 403 }
      );
    }

    await prisma.task.delete({
      where: { id },
    });

    await logAudit({
      action: "TASK_DELETE",
      userId: user.id,
      details: { taskId: id, title: task.title },
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    return NextResponse.json({ message: "Tarea eliminada exitosamente" });
  } catch (err) {
    console.error("Error al eliminar tarea:", err);
    return NextResponse.json({ error: "Error al eliminar tarea" }, { status: 500 });
  }
}
