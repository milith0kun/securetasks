import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureTasks — Sistema de Gestión de Tareas Seguras",
  description: "Plataforma de tareas con autenticación robusta Argon2id, RBAC y defensas en profundidad",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
