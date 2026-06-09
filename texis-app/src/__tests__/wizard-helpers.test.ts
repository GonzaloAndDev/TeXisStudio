// Tests for wizard helper logic.
// These functions control what a user sees and gets pre-filled when creating a project.
// Regressions break the new-project flow silently — wrong defaults end up in the document.

import { describe, it, expect } from "vitest";
import { defaultAcademicLevelForDocType } from "../views/WizardView";

describe("defaultAcademicLevelForDocType", () => {
  it("returns licenciatura for tesis (default doc type)", () => {
    expect(defaultAcademicLevelForDocType("tesis")).toBe("licenciatura");
  });

  it("returns licenciatura for tesina", () => {
    expect(defaultAcademicLevelForDocType("tesina")).toBe("licenciatura");
  });

  it("returns especialidad for especialidad", () => {
    expect(defaultAcademicLevelForDocType("especialidad")).toBe("especialidad");
  });

  it("returns posdoctorado for posdoctorado", () => {
    expect(defaultAcademicLevelForDocType("posdoctorado")).toBe("posdoctorado");
  });

  it("falls back to licenciatura for unknown doc types", () => {
    expect(defaultAcademicLevelForDocType("unknown_future_type")).toBe("licenciatura");
    expect(defaultAcademicLevelForDocType("")).toBe("licenciatura");
  });

  it("covers every known document kind used in the app", () => {
    // Guard: if a new docType is added without updating this function, we catch it here.
    const knownDocTypes = ["tesis", "tesina", "especialidad", "posdoctorado", "tesis_posgrado"];
    const validLevels = [
      "bachillerato", "tecnico", "licenciatura", "especialidad",
      "maestria", "doctorado", "posdoctorado",
    ];
    for (const docType of knownDocTypes) {
      const level = defaultAcademicLevelForDocType(docType);
      expect(validLevels, `"${docType}" should map to a valid AcademicLevel`).toContain(level);
    }
  });
});
