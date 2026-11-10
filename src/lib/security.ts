import { hash, verify } from "@node-rs/argon2";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "./prisma";

// 1. ARGON2ID PASSWORD SECURITY
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain);
  } catch {
    return false;
  }
}

// 2. CRYPTOGRAPHIC TOKEN UTILITIES
export function generateSecureToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash: tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// 3. BRUTE FORCE AND RATE LIMITING
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

export async function checkRateLimit(
  ipAddress: string,
  email: string
): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);

  // Check failures by IP or Email in window
  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      OR: [{ ipAddress }, { email }],
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const oldestFail = await prisma.loginAttempt.findFirst({
      where: {
        OR: [{ ipAddress }, { email }],
        success: false,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "asc" },
    });

    const elapsed = oldestFail ? Date.now() - oldestFail.createdAt.getTime() : 0;
    const retryAfterSeconds = Math.max(1, Math.ceil((LOCKOUT_WINDOW_MINUTES * 60 * 1000 - elapsed) / 1000));

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_FAILED_ATTEMPTS - failedAttempts,
    retryAfterSeconds: 0,
  };
}

export async function recordLoginAttempt(
  ipAddress: string,
  email: string,
  success: boolean
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        ipAddress: ipAddress || "unknown",
        email: email.toLowerCase().trim(),
        success,
      },
    });
  } catch (err) {
    console.error("Error al registrar intento de inicio de sesión:", err);
  }
}

// 4. AUDIT LOGGING (Sin registrar secretos)
export async function logAudit(params: {
  action: string;
  userId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    // Sanitizar detalles: remover contraseñas, tokens y hashes
    const sanitized: Record<string, unknown> = {};
    if (params.details) {
      for (const [key, value] of Object.entries(params.details)) {
        if (/pass|token|secret|hash|credential/i.test(key)) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = value;
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId || null,
        details: Object.keys(sanitized).length > 0 ? JSON.stringify(sanitized) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (err) {
    console.error("Error al registrar auditoría:", err);
  }
}

// 5. VALIDATION SCHEMAS (ZOD)
export const RegisterSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().email("Correo electrónico inválido").max(150),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100)
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
});

export const LoginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "El token es requerido"),
  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100)
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z
    .string()
    .min(8, "La contraseña nueva debe tener al menos 8 caracteres")
    .max(100)
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
});

export const TaskCreateSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(150),
  description: z.string().max(2000).default(""),
  status: z.enum(["pendiente", "en_progreso", "completada"]).default("pendiente"),
});

export const TaskUpdateSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(150).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["pendiente", "en_progreso", "completada"]).optional(),
});

export const UpdateRoleSchema = z.object({
  role: z.enum(["estudiante", "docente", "administrador"]),
});
