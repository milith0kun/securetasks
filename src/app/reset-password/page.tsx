"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard, AuthPage, ErrorBox, inputClass, labelClass, primaryButtonClass } from "@/components/AuthCard";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo restablecer la contraseña");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Restablecer contraseña"
      subtitle="Ingresa el token recibido y define tu nueva contraseña."
      footer={
        <Link href="/login" className="text-blue-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {error && <ErrorBox message={error} />}

      {success ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
          <h2 className="text-sm font-bold text-emerald-900">Contraseña actualizada</h2>
          <p className="text-xs text-emerald-700">
            Tus sesiones anteriores fueron cerradas por seguridad. Redirigiendo al inicio de sesión...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className={labelClass}>
              Token de recuperación
            </label>
            <input
              id="token"
              type="text"
              required
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega el token de 64 caracteres"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          <div>
            <label htmlFor="newPassword" className={labelClass}>
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              required
              maxLength={100}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
            </p>
          </div>

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Actualizando..." : "Cambiar contraseña"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthPage>
      <Suspense fallback={<div className="text-slate-500 text-sm">Cargando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPage>
  );
}
