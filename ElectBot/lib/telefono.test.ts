import { describe, expect, it } from "vitest";
import { digitosTelefono, mismoTelefono } from "./telefono";

describe("digitosTelefono", () => {
  it("quita el código de país 595", () => {
    expect(digitosTelefono("595981123456")).toBe("981123456");
  });
  it("quita el + y el código de país", () => {
    expect(digitosTelefono("+595981123456")).toBe("981123456");
  });
  it("quita el 0 inicial nacional", () => {
    expect(digitosTelefono("0981123456")).toBe("981123456");
  });
  it("quita espacios y guiones", () => {
    expect(digitosTelefono("+595 981 123-456")).toBe("981123456");
  });
  it("deja un número local tal cual", () => {
    expect(digitosTelefono("981123456")).toBe("981123456");
  });
});

describe("mismoTelefono", () => {
  it("matchea distintos formatos del mismo número", () => {
    expect(mismoTelefono("+595981123456", "0981123456")).toBe(true);
    expect(mismoTelefono("595981123456", "981123456")).toBe(true);
  });
  it("distingue números distintos", () => {
    expect(mismoTelefono("0981111111", "0982222222")).toBe(false);
  });
  it("rechaza vacíos", () => {
    expect(mismoTelefono("", "0981123456")).toBe(false);
  });
});
