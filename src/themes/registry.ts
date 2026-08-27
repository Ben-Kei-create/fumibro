export type ProjectTheme = {
  containerClassName: string;
  key: string;
};

const defaultTheme: ProjectTheme = {
  containerClassName: "",
  key: "default",
};

const themes = new Map<string, ProjectTheme>([
  [defaultTheme.key, defaultTheme],
]);

/** Phase 1 keeps one visual theme while preserving a stable replacement seam. */
export function getProjectTheme(themeKey: string): ProjectTheme {
  return themes.get(themeKey) ?? defaultTheme;
}
