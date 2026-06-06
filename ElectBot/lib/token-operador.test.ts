import { beforeAll, describe, expect, it } from "vitest";
import { firmarTokenOperador, verificarTokenOperador } from "./token-operador";

beforeAll(() => {
  process.env.OPERADOR_TOKEN_SECRET = "secret-de-prueba-123";
});

const UID = "b10764d6-e814-407b-81e4-b0b16c4922b5";

describe("token-operador", () => {
  it("firma y verifica un token válido", () => {
    const t = firmarTokenOperador(UID);
    expect(verificarTokenOperador(t)).toBe(UID);
  });

  it("rechaza un token manipulado", () => {
    const t = firmarTokenOperador(UID);
    const manipulado = t.slice(0, -2) + "00";
    expect(verificarTokenOperador(manipulado)).toBeNull();
  });

  it("rechaza un token con otro usuario_id", () => {
    const t = firmarTokenOperador(UID);
    const partes = t.split(".");
    const otro = ["00000000-0000-0000-0000-000000000000", partes[1], partes[2]].join(".");
    expect(verificarTokenOperador(otro)).toBeNull();
  });

  it("rechaza un token expirado", () => {
    const t = firmarTokenOperador(UID, -1); // ya expirado
    expect(verificarTokenOperador(t)).toBeNull();
  });

  it("rechaza basura", () => {
    expect(verificarTokenOperador("")).toBeNull();
    expect(verificarTokenOperador("a.b")).toBeNull();
  });
});
