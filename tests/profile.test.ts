import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db, cookieJar, resetDb, json, sessionFromResponse } from "./setup";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { GET as getProfile, PUT as putProfile } from "@/app/api/profile/route";
import { GET as health } from "@/app/api/health/route";

const PASS = "Segura#2026";

async function signup(n: string) {
  const res = await register(json({ name: "Usuario " + n, email: `${n}@test.com`, password: PASS }));
  cookieJar.value = sessionFromResponse(res);
}
const put = (body: unknown) =>
  putProfile(new Request("http://x/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());

describe("Perfil", () => {
  it("sin sesión devuelve 401", async () => {
    expect((await getProfile()).status).toBe(401);
    expect((await put({ name: "Nuevo" })).status).toBe(401);
  });
  it("cambia el nombre y lo persiste", async () => {
    await signup("a");
    const r = await put({ name: "  Nombre Nuevo  " });
    expect(r.status).toBe(200);
    expect(db.__data.user[0].name).toBe("Nombre Nuevo");
    expect((await (await getProfile()).json()).user.name).toBe("Nombre Nuevo");
  });
  it("rechaza nombre demasiado corto (400)", async () => {
    await signup("a");
    expect((await put({ name: "A" })).status).toBe(400);
  });
  it("no permite cambiar el rol desde el perfil", async () => {
    await signup("a");
    await put({ name: "Nombre Nuevo", role: "administrador" });
    expect(db.__data.user[0].role).toBe("estudiante");
  });
  it("cambia la contraseña con la actual correcta y la nueva funciona en el login", async () => {
    await signup("a");
    expect((await put({ currentPassword: PASS, newPassword: "Nueva#2026x" })).status).toBe(200);
    cookieJar.value = undefined;
    expect((await login(json({ email: "a@test.com", password: PASS }))).status).toBe(401);
    expect((await login(json({ email: "a@test.com", password: "Nueva#2026x" }))).status).toBe(200);
  });
  it("rechaza contraseña actual incorrecta (400) y nueva débil (400)", async () => {
    await signup("a");
    expect((await put({ currentPassword: "Incorrecta#1", newPassword: "Nueva#2026x" })).status).toBe(400);
    expect((await put({ currentPassword: PASS, newPassword: "debil" })).status).toBe(400);
  });
});

describe("Token de recuperación en producción", () => {
  it("no se devuelve en producción por defecto", async () => {
    await signup("a");
    vi.stubEnv("NODE_ENV", "production");
    const body = await (await forgot(json({ email: "a@test.com" }))).json();
    expect(body.resetToken).toBeUndefined();
  });
  it("se devuelve solo con DEMO_RESET_TOKEN=true", async () => {
    await signup("a");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_RESET_TOKEN", "true");
    const body = await (await forgot(json({ email: "a@test.com" }))).json();
    expect(body.resetToken).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Health", () => {
  it("503 sin DATABASE_URL, 200 con base disponible y 503 si la base falla", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await health()).status).toBe(503);
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    (db as any).$queryRaw = async () => [{ "?column?": 1 }];
    expect((await health()).status).toBe(200);
    (db as any).$queryRaw = async () => {
      throw new Error("down");
    };
    expect((await health()).status).toBe(503);
  });
});
