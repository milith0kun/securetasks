// Base de datos en memoria que imita la parte de la API de Prisma usada por la aplicación.
// Permite ejecutar las pruebas de forma aislada, sin tocar PostgreSQL de producción.
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Row[]).some((w) => matches(row, w));
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("gte" in v) return row[k] >= v.gte;
      if ("contains" in v) return String(row[k] ?? "").toLowerCase().includes(String(v.contains).toLowerCase());
      if (k === "user") return matches(row.__user ?? {}, v);
    }
    return row[k] === v;
  });
}

function table(name: string, defaults: () => Row, ctx: () => Record<string, Row[]>) {
  const rows = () => ctx()[name];
  const withUser = (r: Row): Row => ({ ...r, user: ctx().user.find((u) => u.id === r.userId) });
  return {
    create: async ({ data }: any) => {
      const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data };
      if (name === "user" && rows().some((r) => r.email === row.email)) throw new Error("Unique constraint");
      rows().push(row);
      return row;
    },
    findUnique: async ({ where, include }: any) => {
      const r = rows().find((x) => Object.entries(where).every(([k, v]) => x[k] === v));
      if (!r) return null;
      return include?.user ? withUser(r) : r;
    },
    findFirst: async ({ where, orderBy }: any) => {
      const list = rows().filter((r) => matches(r, where));
      if (orderBy?.createdAt === "asc") list.sort((a, b) => a.createdAt - b.createdAt);
      return list[0] ?? null;
    },
    findMany: async ({ where, include }: any = {}) => {
      const list: Row[] = rows().filter((r) => matches({ ...r, __user: ctx().user.find((u) => u.id === r.userId) }, where));
      return (list.map((r) => (include?.user ? withUser(r) : r)) as Row[]).sort((a, b) => b.createdAt - a.createdAt);
    },
    count: async ({ where }: any = {}) => rows().filter((r) => matches(r, where)).length,
    update: async ({ where, data }: any) => {
      const r = rows().find((x) => Object.entries(where).every(([k, v]) => x[k] === v));
      if (!r) throw new Error("Record not found");
      Object.assign(r, data, { updatedAt: new Date() });
      return r;
    },
    updateMany: async ({ where, data }: any) => {
      const list = rows().filter((r) => matches(r, where));
      list.forEach((r) => Object.assign(r, data));
      return { count: list.length };
    },
    delete: async ({ where }: any) => {
      const i = rows().findIndex((x) => x.id === where.id);
      if (i < 0) throw new Error("Record not found");
      return rows().splice(i, 1)[0];
    },
  };
}

export function createFakePrisma() {
  const data: Record<string, Row[]> = {
    user: [],
    session: [],
    passwordResetToken: [],
    task: [],
    auditLog: [],
    loginAttempt: [],
  };
  const ctx = () => data;
  return {
    __data: data,
    user: table("user", () => ({ role: "estudiante" }), ctx),
    session: table("session", () => ({ revokedAt: null }), ctx),
    passwordResetToken: table("passwordResetToken", () => ({ usedAt: null }), ctx),
    task: table("task", () => ({ status: "pendiente" }), ctx),
    auditLog: table("auditLog", () => ({}), ctx),
    loginAttempt: table("loginAttempt", () => ({}), ctx),
  };
}
