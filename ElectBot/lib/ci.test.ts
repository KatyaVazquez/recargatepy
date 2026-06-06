import { describe, expect, it } from "vitest";
import { normalizarCI } from "./ci";

describe("normalizarCI", () => {
  it("acepta un CI simple", () => {
    expect(normalizarCI("1234567")).toEqual({ ok: true, ci: "1234567" });
  });

  it("quita puntos", () => {
    expect(normalizarCI("1.234.567")).toEqual({ ok: true, ci: "1234567" });
  });

  it("quita guiones", () => {
    expect(normalizarCI("1-234-567")).toEqual({ ok: true, ci: "1234567" });
  });

  it("quita espacios al inicio, fin y medio", () => {
    expect(normalizarCI("  1 234 567  ")).toEqual({ ok: true, ci: "1234567" });
  });

  it("descarta letras mezcladas (caso borde 1234567X)", () => {
    expect(normalizarCI("1234567X")).toEqual({ ok: true, ci: "1234567" });
  });

  it("quita tabs y newlines invisibles", () => {
    expect(normalizarCI("\t1234567\n")).toEqual({ ok: true, ci: "1234567" });
  });

  it("acepta el mínimo de 5 dígitos", () => {
    expect(normalizarCI("12345")).toEqual({ ok: true, ci: "12345" });
  });

  it("acepta el máximo de 9 dígitos", () => {
    expect(normalizarCI("123456789")).toEqual({ ok: true, ci: "123456789" });
  });

  it("rechaza menos de 5 dígitos", () => {
    expect(normalizarCI("1234")).toEqual({ ok: false, motivo: "longitud" });
  });

  it("rechaza más de 9 dígitos", () => {
    expect(normalizarCI("1234567890")).toEqual({ ok: false, motivo: "longitud" });
  });

  it("rechaza string vacío", () => {
    expect(normalizarCI("")).toEqual({ ok: false, motivo: "vacio" });
  });

  it("rechaza solo espacios", () => {
    expect(normalizarCI("   ")).toEqual({ ok: false, motivo: "vacio" });
  });

  it("rechaza solo letras", () => {
    expect(normalizarCI("abcdef")).toEqual({ ok: false, motivo: "vacio" });
  });

  it("trata como iguales los distintos formatos del mismo CI", () => {
    const formatos = ["1.234.567", "1234567", " 1234567 ", "1234567X"];
    const normalizados = formatos.map((f) => {
      const r = normalizarCI(f);
      return r.ok ? r.ci : null;
    });
    expect(new Set(normalizados)).toEqual(new Set(["1234567"]));
  });
});
