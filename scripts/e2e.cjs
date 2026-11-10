// Recorrido E2E contra una instancia en ejecución (E2E_BASE) y su base real. Crea datos temporales y los elimina al final.
// Requiere DATABASE_URL y E2E_PASS_ESTUDIANTE2, E2E_PASS_DOCENTE y E2E_PASS_ADMIN (cuentas estudiante2@, docente@ y admin@prueba.com). Uso: node scripts/e2e.cjs .
const root = process.argv[2];
const { PrismaClient } = require(root + "/node_modules/@prisma/client");
const db = new PrismaClient();
const BASE = process.env.E2E_BASE || "http://localhost:3100";
const need = (k) => {
  if (!process.env[k]) { console.error("Falta la variable de entorno " + k); process.exit(2); }
  return process.env[k];
};
const PW_E2 = need("E2E_PASS_ESTUDIANTE2");
const PW_DOC = need("E2E_PASS_DOCENTE");
const PW_ADM = need("E2E_PASS_ADMIN");
const tag = "e2e-" + Date.now();
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log((ok ? "OK    " : "FALLA ") + name + (extra ? "  [" + extra + "]" : ""));
};

class Client {
  constructor() { this.cookie = ""; }
  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const m = sc.match(/securetasks_session=([^;]*)/);
      this.cookie = m && m[1] ? "securetasks_session=" + m[1] : "";
    }
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, headers: res.headers };
  }
}

(async () => {
  const email = `${tag}@prueba.com`;
  const pass = "Aa1#" + require("crypto").randomBytes(6).toString("hex");
  const created = { users: [], tasks: [] };
  try {
    // --- REGISTRO ---
    const u = new Client();
    let r = await u.req("POST", "/api/auth/register", { name: "E2E Temporal", email, password: pass, role: "administrador" });
    check("Registro (201) y rol forzado a estudiante", r.status === 201 && r.json.user.role === "estudiante");
    let row = await db.user.findUnique({ where: { email } });
    created.users.push(row.id);
    check("BD: usuario guardado con hash argon2id", row && row.passwordHash.startsWith("$argon2id$") && row.role === "estudiante");
    r = await new Client().req("POST", "/api/auth/register", { name: "Dup", email, password: pass });
    check("Registro duplicado (409)", r.status === 409);
    r = await new Client().req("POST", "/api/auth/register", { name: "A", email: "mal", password: "1" });
    check("Registro con datos inválidos (400)", r.status === 400);
    check("BD: sesión creada al registrar", (await db.session.count({ where: { userId: row.id } })) === 1);

    // --- /me, PERFIL ---
    r = await u.req("GET", "/api/auth/me");
    check("/me con sesión (200)", r.status === 200 && r.json.user.email === email);
    r = await u.req("PUT", "/api/profile", { name: "Nombre Cambiado" });
    row = await db.user.findUnique({ where: { email } });
    check("Perfil: nombre guardado en BD", r.status === 200 && row.name === "Nombre Cambiado");
    r = await u.req("PUT", "/api/profile", { currentPassword: "Incorrecta#1", newPassword: "Otra#2026xx" });
    check("Perfil: contraseña actual incorrecta (400)", r.status === 400);
    r = await u.req("PUT", "/api/profile", { currentPassword: pass, newPassword: "Nueva#2026xx" });
    const h1 = row.passwordHash;
    row = await db.user.findUnique({ where: { email } });
    check("Perfil: cambio de contraseña guarda nuevo hash", r.status === 200 && row.passwordHash !== h1);

    // --- LOGOUT / LOGIN ---
    r = await u.req("POST", "/api/auth/logout");
    check("Logout (200)", r.status === 200);
    r = await u.req("GET", "/api/auth/me");
    check("Tras logout /me da 401", r.status === 401);
    check("BD: sesión revocada", (await db.session.count({ where: { userId: row.id, revokedAt: { not: null } } })) >= 1);
    r = await u.req("POST", "/api/auth/login", { email, password: pass });
    check("Login con contraseña vieja (401)", r.status === 401);
    r = await u.req("POST", "/api/auth/login", { email, password: "Nueva#2026xx" });
    check("Login con contraseña nueva (200) y cookie HttpOnly", r.status === 200 && /httponly/i.test(r.headers.get("set-cookie") || ""));

    // --- TAREAS (CRUD + filtros) ---
    r = await u.req("POST", "/api/tasks", { title: tag + " A", description: "desc A", status: "pendiente" });
    const tA = r.json?.task?.id; created.tasks.push(tA);
    row = await db.task.findUnique({ where: { id: tA } });
    check("Tarea creada y guardada en BD con dueño", r.status === 201 && row.title === tag + " A");
    r = await u.req("POST", "/api/tasks", { title: tag + " B", description: "otra", status: "en_progreso" });
    const tB = r.json?.task?.id; created.tasks.push(tB);
    r = await u.req("POST", "/api/tasks", { title: "", status: "x" });
    check("Tarea inválida (400)", r.status === 400);
    r = await u.req("GET", "/api/tasks");
    check("Listado devuelve solo las propias", r.status === 200 && r.json.tasks.length === 2);
    r = await u.req("GET", "/api/tasks?status=en_progreso");
    check("Filtro por estado", r.json.tasks.length === 1 && r.json.tasks[0].id === tB);
    r = await u.req("GET", "/api/tasks?search=" + encodeURIComponent("DESC A"));
    check("Búsqueda por descripción (sin distinguir mayúsculas)", r.json.tasks.length === 1 && r.json.tasks[0].id === tA);
    r = await u.req("GET", "/api/tasks?search=" + encodeURIComponent("'; DROP TABLE \"Task\"; --"));
    check("Búsqueda con SQLi inocua (200, 0 resultados, tabla intacta)", r.status === 200 && r.json.tasks.length === 0 && (await db.task.count()) >= 2);
    r = await u.req("PUT", "/api/tasks/" + tA, { status: "completada", title: tag + " A editada" });
    row = await db.task.findUnique({ where: { id: tA } });
    check("Edición guardada en BD", r.status === 200 && row.status === "completada" && row.title.endsWith("editada"));
    r = await u.req("GET", "/api/tasks/" + tA);
    check("Consulta individual (200)", r.status === 200 && r.json.task.id === tA);

    // --- IDOR con otra cuenta (estudiante2) ---
    const e2 = new Client();
    r = await e2.req("POST", "/api/auth/login", { email: "estudiante2@prueba.com", password: PW_E2 });
    check("Login estudiante2", r.status === 200);
    r = await e2.req("GET", "/api/tasks/" + tA);
    check("IDOR GET (403)", r.status === 403);
    r = await e2.req("PUT", "/api/tasks/" + tA, { title: "hack" });
    check("IDOR PUT (403)", r.status === 403);
    r = await e2.req("DELETE", "/api/tasks/" + tA);
    check("IDOR DELETE (403)", r.status === 403);
    row = await db.task.findUnique({ where: { id: tA } });
    check("BD: tarea ajena intacta tras intentos IDOR", row && row.title.endsWith("editada"));
    r = await e2.req("GET", "/api/admin/users");
    check("Estudiante en /admin/users (403)", r.status === 403);
    r = await e2.req("GET", "/api/teacher/summary");
    check("Estudiante en resumen docente (403)", r.status === 403);
    r = await e2.req("PATCH", `/api/admin/users/${created.users[0]}/role`, { role: "administrador" });
    check("Estudiante cambiando rol (403)", r.status === 403);

    // --- DOCENTE ---
    const d = new Client();
    await d.req("POST", "/api/auth/login", { email: "docente@prueba.com", password: PW_DOC });
    r = await d.req("GET", "/api/teacher/summary");
    check("Docente: resumen (200) con métricas", r.status === 200 && typeof r.json.studentsMetrics.totalStudents === "number");
    r = await d.req("GET", "/api/tasks/" + tA);
    check("Docente no ve tareas ajenas (403)", r.status === 403);

    // --- ADMIN ---
    const a = new Client();
    await a.req("POST", "/api/auth/login", { email: "admin@prueba.com", password: PW_ADM });
    r = await a.req("GET", "/api/admin/users");
    check("Admin: lista de usuarios con conteo de tareas", r.status === 200 && r.json.users.some((x) => x.email === email && x._count.tasks === 2));
    r = await a.req("GET", "/api/tasks");
    check("Admin ve todas las tareas", r.status === 200 && r.json.tasks.some((t) => t.id === tA));
    r = await a.req("PATCH", `/api/admin/users/${created.users[0]}/role`, { role: "docente" });
    row = await db.user.findUnique({ where: { email } });
    check("Admin cambia rol y se guarda en BD", r.status === 200 && row.role === "docente");
    r = await a.req("PATCH", `/api/admin/users/${created.users[0]}/role`, { role: "superroot" });
    check("Rol inválido (400)", r.status === 400);
    const adminRow = await db.user.findUnique({ where: { email: "admin@prueba.com" } });
    r = await a.req("PATCH", `/api/admin/users/${adminRow.id}/role`, { role: "estudiante" });
    check("Admin no puede cambiar su propio rol (400)", r.status === 400);
    r = await a.req("GET", "/api/admin/audit-logs");
    const acts = new Set(r.json.logs.map((l) => l.action));
    check("Auditoría registra eventos clave", ["AUTH_REGISTER", "TASK_CREATE", "TASK_UPDATE", "SECURITY_IDOR_BLOCKED", "ADMIN_ROLE_CHANGE", "SECURITY_PRIVILEGE_ESCALATION_BLOCKED"].every((x) => acts.has(x)), [...acts].length + " tipos");
    const blob = JSON.stringify(r.json.logs);
    check("Auditoría sin contraseñas ni hashes", !blob.includes(pass) && !blob.includes("Nueva#2026xx") && !blob.includes("$argon2"));
    // el rol del usuario temporal ahora es docente: tiene que ver el resumen
    r = await u.req("GET", "/api/teacher/summary");
    check("Rol docente aplicado de inmediato", r.status === 200);

    // --- ELIMINAR ---
    r = await u.req("DELETE", "/api/tasks/" + tB);
    check("Eliminar tarea propia y desaparece de la BD", r.status === 200 && !(await db.task.findUnique({ where: { id: tB } })));

    // --- RECUPERACIÓN ---
    r = await new Client().req("POST", "/api/auth/forgot-password", { email });
    const tok = r.json.resetToken;
    row = await db.passwordResetToken.findFirst({ where: { userId: created.users[0], usedAt: null } });
    check("Recuperación: token emitido y solo su hash en BD", r.status === 200 && tok && row && row.tokenHash !== tok);
    r = await new Client().req("POST", "/api/auth/forgot-password", { email: "noexiste@prueba.com" });
    check("Recuperación: correo inexistente da 200 genérico", r.status === 200 && !r.json.resetToken);
    r = await new Client().req("POST", "/api/auth/reset-password", { token: tok, newPassword: "Final#2026xy" });
    check("Reset con token (200)", r.status === 200);
    r = await new Client().req("POST", "/api/auth/reset-password", { token: tok, newPassword: "Final#2026xz" });
    check("Reutilizar token (400)", r.status === 400);
    r = await u.req("GET", "/api/auth/me");
    check("Reset revocó las sesiones activas (401)", r.status === 401);
    r = await new Client().req("POST", "/api/auth/login", { email, password: "Final#2026xy" });
    check("Login con la contraseña restablecida", r.status === 200);

    // --- FUERZA BRUTA (cuenta temporal inexistente, 5 fallos) ---
    const bf = new Client();
    for (let i = 0; i < 5; i++) await bf.req("POST", "/api/auth/login", { email: `${tag}-bf@prueba.com`, password: "Mala#2026x" });
    r = await bf.req("POST", "/api/auth/login", { email: `${tag}-bf@prueba.com`, password: "Mala#2026x" });
    check("Fuerza bruta: bloqueo 429 con Retry-After", r.status === 429 && !!r.headers.get("retry-after"));
    r = await bf.req("POST", "/api/auth/login", { email, password: "Final#2026xy" });
    check("El bloqueo por IP también protege otras cuentas (429)", r.status === 429);
  } catch (e) {
    check("EXCEPCIÓN en el recorrido", false, String(e.message).slice(0, 120));
  } finally {
    // --- LIMPIEZA ---
    await db.task.deleteMany({ where: { title: { startsWith: tag } } });
    for (const id of created.users) {
      await db.auditLog.deleteMany({ where: { userId: id } });
      await db.user.deleteMany({ where: { id } }); // sesiones y tokens se eliminan en cascada
    }
    await db.loginAttempt.deleteMany({ where: { email: { startsWith: tag } } });
    // restaurar el rol/clave de las cuentas de prueba no se modificó; limpiar intentos de login de la IP local
    await db.loginAttempt.deleteMany({ where: { ipAddress: { in: ["127.0.0.1", "::1", "::ffff:127.0.0.1", "unknown"] } } });
    const left = await db.user.count({ where: { email: { startsWith: tag } } });
    console.log("\nLimpieza: usuarios temporales restantes =", left, "| usuarios totales =", await db.user.count(), "| tareas totales =", await db.task.count());
    await db.$disconnect();
    const bad = results.filter((x) => !x).length;
    console.log(`\nRESULTADO: ${results.length - bad}/${results.length} comprobaciones correctas`);
    process.exit(bad ? 1 : 0);
  }
})();
