import Link from "next/link";
import type { ReactNode } from "react";

export const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
export const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1";
export const primaryButtonClass =
  "w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8 space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="text-sm font-bold tracking-tight text-blue-600">
          SecureTasks
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
      <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">{footer}</div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
      {message}
    </div>
  );
}

export function AuthPage({ children }: { children: ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">{children}</div>;
}
