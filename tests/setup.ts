import { vi } from "vitest";
import { createFakePrisma } from "./fakePrisma";

export const db = createFakePrisma();
export const cookieJar: { value?: string } = {};

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "securetasks_session" && cookieJar.value ? { value: cookieJar.value } : undefined,
  }),
}));

export function resetDb() {
  for (const k of Object.keys(db.__data)) db.__data[k].length = 0;
  cookieJar.value = undefined;
}

export const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

export const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

export function sessionFromResponse(res: Response): string | undefined {
  const m = res.headers.get("set-cookie")?.match(/securetasks_session=([^;]*)/);
  return m?.[1] || undefined;
}
