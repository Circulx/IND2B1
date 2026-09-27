import { TEMPLATES } from "../catalog";
import type { Theme } from "../types";

export const themeFromTemplateForSeed = (templateId: string, version = 1): Theme => {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0]!;
  return { templateId: t.id, version, tokens: { ...t.tokens }, sections: structuredClone(t.sections) };
};
