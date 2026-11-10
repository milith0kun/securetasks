import { describe, it, expect, beforeEach } from "vitest";
import { db, cookieJar, resetDb, json, ctxId, sessionFromResponse } from "./setup";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { GET as listTasks, POST as createTask } from "@/app/api/tasks/route";
import { GET as getTask, PUT as putTask, DELETE as delTask } from "@/app/api/tasks/[id]/route";
import { PATCH as patchRole } from "@/app/api/admin/users/[id]/role/route";
import { GET as adminUsers } from "@/app/api/admin/users/route";
import { GET as summary } from "@/app/api/teacher/summary/route";
import { hashPassword } from "@/lib/security";
import fs from "fs";

const PASS = "Segura#2026";
const creds = (n: string) => ({ name: "Usuario " + n, email: `${n}@test.com`, password: PASS });
const get = (url = "http://x/api") => new Request(url);

async function signup(n: string) {
  const res = await register(json(creds(n)));
  cookieJar.value = sessionFromResponse(res);
  return { res, body: await res.json() };
}
async function seedUser(n: string, role: "docente" | "administrador") {
  return db.user.create({
    data: { name: n, email: `${n}@test.com`, passwordHash: await hashPassword(PASS), role },
  });
}
async function loginAs(n: string) {
  const res = await login(json({ email: `${n}@test.com`, password: PASS }));
  cookieJar.value = sessionFromResponse(res);
  return res;
}

beforeEach(resetDb);

describe("Registro y autenticación", () => {
  it("registra un usuario y fuerza el rol estudiante aunque se envíe otro", async () => {
    const res = await register(json({ ...creds("a"), role: "administrador" }));
    expect(res.status).toBe(201);
    expect((await res.json()).user.role).toBe("estudiante");
    expect(db.__data.user[0].passwordHash).toMatch(/^\$argon2id\$/);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });
  it("rechaza correo duplicado con 409", async () => {
    await signup("a");
    expect((await register(json(creds("a")))).status).toBe(409);
  });
  it("login correcto devuelve sesión y /me responde 200", async () => {
    await signup("a");
    cookieJar.value = undefined;
    expect((await loginAs("a")).status).toBe(200);
    expect((await me()).status).toBe(200);
  });
  it("credenciales inválidas devuelven 401", async () => {
    await signup("a");
    expect((await login(json({ email: "a@test.com", password: "Mala#1234x" }))).status).toBe(401);
    expect((await login(json({ email: "noexiste@test.com", password: PASS }))).status).toBe(401);
  });
  it("sin sesión /me devuelve 401", async () => {
    expect((await me()).status).toBe(401);
  });
});

describe("Fuerza bruta", () => {
  it("bloquea con 429 tras 5 intentos fallidos, incluso con la clave correcta", async () => {
    await signup("a");
    for (let i = 0; i < 5; i++) {
      expect((await login(json({ email: "a@test.com", password: "Mala#1234x" }))).status).toBe(401);
    }
    const blocked = await login(json({ email: "a@test.com", password: PASS }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});

describe("Sesiones", () => {
  it("sesión expirada es rechazada con 401", async () => {
    await signup("a");
    db.__data.session[0].expiresAt = new Date(Date.now() - 1000);
    expect((await me()).status).toBe(401);
  });
  it("sesión revocada (logout) no se puede reutilizar", async () => {
    await signup("a");
    const token = cookieJar.value;
    expect((await logout(json({}))).status).toBe(200);
    cookieJar.value = token;
    expect((await me()).status).toBe(401);
  });
  it("solo se guarda el hash del token de sesión", async () => {
    await signup("a");
    expect(db.__data.session[0].tokenHash).not.toBe(cookieJar.value);
  });
});

describe("Recuperación de contraseña", () => {
  it("el token es de un solo uso y la reutilización devuelve 400", async () => {
    await signup("a");
    const { resetToken } = await (await forgot(json({ email: "a@test.com" }))).json();
    expect((await reset(json({ token: resetToken, newPassword: "Nueva#2026x" }))).status).toBe(200);
    expect((await reset(json({ token: resetToken, newPassword: "Otra#2026xx" }))).status).toBe(400);
  });
  it("un token nuevo invalida el anterior y el restablecimiento revoca sesiones", async () => {
    await signup("a");
    const t1 = (await (await forgot(json({ email: "a@test.com" }))).json()).resetToken;
    const t2 = (await (await forgot(json({ email: "a@test.com" }))).json()).resetToken;
    expect((await reset(json({ token: t1, newPassword: "Nueva#2026x" }))).status).toBe(400);
    expect((await reset(json({ token: t2, newPassword: "Nueva#2026x" }))).status).toBe(200);
    expect((await me()).status).toBe(401);
  });
  it("token expirado devuelve 400 y correo inexistente no revela información", async () => {
    await signup("a");
    const { resetToken } = await (await forgot(json({ email: "a@test.com" }))).json();
    db.__data.passwordResetToken[0].expiresAt = new Date(Date.now() - 1000);
    expect((await reset(json({ token: resetToken, newPassword: "Nueva#2026x" }))).status).toBe(400);
    expect((await forgot(json({ email: "nadie@test.com" }))).status).toBe(200);
  });
  it("no se guarda el token ni la contraseña en claro, ni en auditoría", async () => {
    await signup("a");
    const { resetToken } = await (await forgot(json({ email: "a@test.com" }))).json();
    expect(JSON.stringify(db.__data.passwordResetToken)).not.toContain(resetToken);
    expect(JSON.stringify(db.__data.auditLog)).not.toContain(resetToken);
    expect(JSON.stringify(db.__data.auditLog)).not.toContain(PASS);
  });
});

describe("Tareas, IDOR y roles", () => {
  async function twoStudents() {
    await signup("a");
    const t = await (await createTask(json({ title: "Privada", description: "x" }))).json();
    await signup("b");
    return t.task.id as string;
  }
  it("CRUD de tareas propias", async () => {
    await signup("a");
    const c = await createTask(json({ title: "T1", description: "d" }));
    expect(c.status).toBe(201);
    const id = (await c.json()).task.id;
    expect((await getTask(get(), ctxId(id))).status).toBe(200);
    const up = await putTask(json({ status: "completada" }), ctxId(id));
    expect((await up.json()).task.status).toBe("completada");
    expect((await delTask(get(), ctxId(id))).status).toBe(200);
    expect((await getTask(get(), ctxId(id))).status).toBe(404);
  });
  it("IDOR: otro estudiante recibe 403 en GET, PUT y DELETE y no ve la tarea en el listado", async () => {
    const id = await twoStudents();
    expect((await getTask(get(), ctxId(id))).status).toBe(403);
    expect((await putTask(json({ title: "hack" }), ctxId(id))).status).toBe(403);
    expect((await delTask(get(), ctxId(id))).status).toBe(403);
    const list = await (await listTasks(get("http://x/api/tasks"))).json();
    expect(list.tasks).toHaveLength(0);
    expect(db.__data.task[0].title).toBe("Privada");
  });
  it("el propietario no se puede suplantar enviando userId", async () => {
    const { body } = await signup("a");
    const r = await createTask(json({ title: "T", userId: "otro" }));
    expect((await r.json()).task.userId).toBe(body.user.id);
  });
  it("el administrador ve todas las tareas", async () => {
    await twoStudents();
    await seedUser("admin", "administrador");
    await loginAs("admin");
    const list = await (await listTasks(get("http://x/api/tasks"))).json();
    expect(list.tasks).toHaveLength(1);
  });
  it("estudiante no puede cambiar roles ni listar usuarios (403)", async () => {
    const { body } = await signup("a");
    expect((await patchRole(json({ role: "administrador" }), ctxId(body.user.id))).status).toBe(403);
    expect((await adminUsers()).status).toBe(403);
    expect(db.__data.user[0].role).toBe("estudiante");
  });
  it("administrador cambia roles y un rol inválido da 400", async () => {
    const { body } = await signup("a");
    await seedUser("admin", "administrador");
    await loginAs("admin");
    expect((await patchRole(json({ role: "superroot" }), ctxId(body.user.id))).status).toBe(400);
    expect((await patchRole(json({ role: "docente" }), ctxId(body.user.id))).status).toBe(200);
  });
  it("resumen docente: estudiante recibe 403", async () => {
    await signup("a");
    expect((await summary()).status).toBe(403);
  });
  it("endpoints sin sesión devuelven 401", async () => {
    expect((await listTasks(get("http://x/api/tasks"))).status).toBe(401);
    expect((await createTask(json({ title: "x" }))).status).toBe(401);
  });
});

describe("Validación, SQLi y XSS", () => {
  it("entradas inválidas devuelven 400", async () => {
    expect((await register(json({ name: "A", email: "no-es-correo", password: "123" }))).status).toBe(400);
    expect((await login(json({ email: "x" }))).status).toBe(400);
    await signup("a");
    expect((await createTask(json({ title: "" }))).status).toBe(400);
    expect((await createTask(json({ title: "ok", status: "inventado" }))).status).toBe(400);
    expect((await createTask(json({ title: "x".repeat(151) }))).status).toBe(400);
  });
  it("SQLi en login se trata como dato: 400/401, nunca acceso", async () => {
    await signup("a");
    expect((await login(json({ email: "' OR '1'='1", password: "x" }))).status).toBe(400);
    expect((await login(json({ email: "a@test.com", password: "' OR '1'='1' --" }))).status).toBe(401);
  });
  it("SQLi en búsqueda no expone tareas ajenas ni altera la tabla", async () => {
    await signup("a");
    await createTask(json({ title: "mia" }));
    await signup("b");
    const url =
      "http://x/api/tasks?search=" +
      encodeURIComponent("'; DROP TABLE \"Task\"; --") +
      "&status=" +
      encodeURIComponent("x' OR 1=1");
    const r = await listTasks(get(url));
    expect(r.status).toBe(200);
    expect((await r.json()).tasks).toHaveLength(0);
    expect(db.__data.task).toHaveLength(1);
  });
  it("XSS: el contenido se almacena como texto y se devuelve como JSON", async () => {
    await signup("a");
    const payload = '<script>alert("xss")</script>';
    const r = await createTask(json({ title: payload, description: "<img src=x onerror=alert(1)>" }));
    expect(r.status).toBe(201);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect((await r.json()).task.title).toBe(payload);
  });
  it("el frontend no usa dangerouslySetInnerHTML ni innerHTML", () => {
    const src = fs.readFileSync("src/app/page.tsx", "utf8");
    expect(src).not.toContain("dangerouslySetInnerHTML");
    expect(src).not.toContain("innerHTML");
  });
});
