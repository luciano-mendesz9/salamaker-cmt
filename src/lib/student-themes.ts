export const DEFAULT_STUDENT_THEME = "default-dark" as const;
export const STUDENT_THEME_PRICE = 30;
export const STUDENT_THEME_STORAGE_KEY = "sala-maker-student-theme";

export const STUDENT_THEMES = [
  {
    key: DEFAULT_STUDENT_THEME,
    name: "Padrão Dark",
    description: "Azul tecnológico com superfícies escuras.",
    price: 0,
    colors: ["#328fff", "#101b2e", "#080d19"],
  },
  {
    key: "red-dark",
    name: "Vermelho Dark",
    description: "Carmesim, vinho e grafite em alto contraste.",
    price: STUDENT_THEME_PRICE,
    colors: ["#f04455", "#42131c", "#09070b"],
  },
  {
    key: "default-light",
    name: "Padrão Light",
    description: "Azul royal, cartões brancos e fundo azul-gelo.",
    price: STUDENT_THEME_PRICE,
    colors: ["#246bfe", "#ffffff", "#edf7ff"],
  },
  {
    key: "pink-dark",
    name: "Rosa Dark",
    description: "Rosa vibrante, ameixa e superfícies noturnas.",
    price: STUDENT_THEME_PRICE,
    colors: ["#ec4899", "#3b172d", "#0c0710"],
  },
  {
    key: "pink-light",
    name: "Rosa Light",
    description: "Rosa framboesa, branco e fundo blush suave.",
    price: STUDENT_THEME_PRICE,
    colors: ["#db2777", "#ffffff", "#fff2f8"],
  },
  {
    key: "orange-dark",
    name: "Laranja Dark",
    description: "Laranja intenso, cobre e grafite aquecido.",
    price: STUDENT_THEME_PRICE,
    colors: ["#f97316", "#3b1d0d", "#0e0905"],
  },
  {
    key: "orange-light",
    name: "Laranja Light",
    description: "Laranja vivo, branco e fundo creme moderno.",
    price: STUDENT_THEME_PRICE,
    colors: ["#ea580c", "#ffffff", "#fff6eb"],
  },
  {
    key: "green-dark",
    name: "Verde Dark",
    description: "Verde vivo, esmeralda profunda e superfícies noturnas.",
    price: STUDENT_THEME_PRICE,
    colors: ["#22c55e", "#10331f", "#050c08"],
  },
  {
    key: "green-light",
    name: "Verde Light",
    description: "Verde vibrante, branco e fundo menta luminoso.",
    price: STUDENT_THEME_PRICE,
    colors: ["#16a34a", "#ffffff", "#edfff3"],
  },
  {
    key: "gray-dark",
    name: "Gray Dark",
    description: "Cinza grafite, aço e superfícies sóbrias em alto contraste.",
    price: STUDENT_THEME_PRICE,
    colors: ["#94a3b8", "#1d2129", "#090b0f"],
  },
  {
    key: "gray-light",
    name: "Gray Light",
    description: "Cinza moderno, branco e fundo gelo minimalista.",
    price: STUDENT_THEME_PRICE,
    colors: ["#64748b", "#ffffff", "#f1f5f9"],
  },
  {
    key: "kids-light",
    name: "Kids Light",
    description: "Azul, rosa, amarelo, verde e roxo em uma interface alegre e infantil.",
    price: STUDENT_THEME_PRICE,
    colors: ["#2563eb", "#ec4899", "#facc15", "#22c55e", "#8b5cf6"],
  },
] as const;

export type StudentThemeKey = (typeof STUDENT_THEMES)[number]["key"];
export const STUDENT_THEME_KEYS = STUDENT_THEMES.map(({ key }) => key) as [StudentThemeKey, ...StudentThemeKey[]];

export function isStudentThemeKey(value: string): value is StudentThemeKey {
  return STUDENT_THEME_KEYS.some((key) => key === value);
}

export function normalizeStudentTheme(value: string | null | undefined): StudentThemeKey {
  return value && isStudentThemeKey(value) ? value : DEFAULT_STUDENT_THEME;
}

export function getStudentTheme(key: StudentThemeKey) {
  return STUDENT_THEMES.find((theme) => theme.key === key) ?? STUDENT_THEMES[0];
}
