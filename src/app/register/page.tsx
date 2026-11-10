"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthCard, AuthPage, ErrorBox, inputClass, labelClass, primaryButtonClass } from "@/components/AuthCard";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Misma política que valida el servidor (RegisterSchema)
  const rules = [
    { label: "Mínimo 8 caracteres", pass: password.length >= 8 },
    { label: "Una mayúscula", pass: /[A-Z]/.test(password) },
    { label: "Una minúscula", pass: /[a-z]/.test(password) },
    { label: "Un número", pass: /[0-9]/.test(password) },
    { label: "Un carácter especial", pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const isPasswordValid = rules.every((r) => r.pass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError("La contraseña no cumple con todos los requisitos de seguridad");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar usuario");
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
        title="Crear cuenta"
        subtitle={
          <>
            El rol asignado al registrarte es <strong>estudiante</strong>.
          </>
        }
        footer={
          <>
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">
              Inicia sesión
            </Link>
          </>
        }
      >
        {error && <ErrorBox message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>
              Nombre completo
            </label>
            <input
              id="name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellidos"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              maxLength={150}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              maxLength={100}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <ul className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
            {rules.map((rule) => (
              <li key={rule.label} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${rule.pass ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className={rule.pass ? "text-emerald-700 font-medium" : "text-slate-500"}>{rule.label}</span>
              </li>
            ))}
          </ul>

          <button type="submit" disabled={loading || !isPasswordValid} className={primaryButtonClass}>
            {loading ? "Creando cuenta..." : "Registrarme"}
          </button>
        </form>
      </AuthCard>
    </AuthPage>
  );
}
