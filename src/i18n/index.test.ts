import { afterEach, describe, expect, it } from "vitest";

import en from "./en.json";
import es from "./es.json";
import { i18n, t } from "./index";

afterEach(() => {
  i18n.global.locale.value = "en";
});

describe("shared t wrapper", () => {
  it("returns the English message by default", () => {
    expect(t("reader.play")).toBe(en["reader.play"]);
  });

  it("returns the Spanish message when the locale is 'es'", () => {
    i18n.global.locale.value = "es";
    expect(t("reader.play")).toBe(es["reader.play"]);
    expect(es["reader.play"]).not.toBe(en["reader.play"]);
  });

  it("interpolates named parameters", () => {
    expect(t("recent.open", { title: "Moby Dick" })).toBe(en["recent.open"].replace("{title}", "Moby Dick"));
  });
});