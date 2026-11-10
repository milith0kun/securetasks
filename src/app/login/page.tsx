"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard, AuthPage, ErrorBox, inputClass, labelClass, primaryButtonClass } from "@/components/AuthCard";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRemainingAttempts(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        if (typeof data.remainingAttempts === "number") setRemainingAttempts(data.remainingAttempts);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPage>
      <AuthCard
        title="Iniciar sesión"
        subtitle="Accede al sistema de gestión de tareas"
        footer={
          <>
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className="text-blue-600 font-semibold hover:underline">
              Regístrate como estudiante
            </Link>
          </>
        }
      >
        {error && (
          <div className="space-y-1">
            <ErrorBox message={error} />
            {remainingAttempts !== null && remainingAttempts > 0 && (
              <p className="text-xs text-red-600">
                Intentos restantes antes del bloqueo temporal: {remainingAttempts}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Contraseña
              </label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>
      </AuthCard>
    </AuthPage>
  );
}
