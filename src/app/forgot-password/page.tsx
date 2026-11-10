"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, AuthPage, ErrorBox, inputClass, labelClass, primaryButtonClass } from "@/components/AuthCard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tokenHint, setTokenHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo procesar la solicitud");
        return;
      }
      setSubmitted(true);
      if (data.resetToken) setTokenHint(data.resetToken);
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPage>
      <AuthCard
        title="Recuperar contraseña"
        subtitle="Solicita un token de un solo uso para restablecer tu contraseña."
        footer={
          <Link href="/login" className="text-slate-600 hover:text-blue-600">
            Volver a iniciar sesión
          </Link>
        }
      >
        {error && <ErrorBox message={error} />}

        {submitted ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-emerald-800">Solicitud procesada</p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Si el correo está registrado, se emitió un token válido por 15 minutos.
            </p>
            {tokenHint && (
              <div className="pt-2 border-t border-emerald-200/60">
                <p className="text-[11px] font-semibold text-emerald-900 mb-1">Token (modo demostración):</p>
                <code className="block p-2 bg-emerald-100 rounded text-xs text-emerald-950 font-mono break-all select-all">
                  {tokenHint}
                </code>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(tokenHint)}`}
                  className="mt-3 inline-block text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline"
                >
                  Continuar al restablecimiento
                </Link>
              </div>
            )}
            {!tokenHint && (
              <Link href="/reset-password" className="inline-block text-xs font-semibold text-emerald-800 underline">
                Ya tengo un token
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>
                Correo registrado
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
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Generando..." : "Generar token de recuperación"}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}
