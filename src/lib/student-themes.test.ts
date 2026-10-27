import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_STUDENT_THEME, STUDENT_THEMES, STUDENT_THEME_PRICE, normalizeStudentTheme } from "./student-themes";

test("student theme catalog keeps the current theme free and paid themes at 30 DC", () => {
  assert.equal(STUDENT_THEMES[0].key, DEFAULT_STUDENT_THEME);
  assert.equal(STUDENT_THEMES[0].price, 0);
  assert.ok(STUDENT_THEMES.slice(1).every((theme) => theme.price === STUDENT_THEME_PRICE));
  assert.deepEqual(STUDENT_THEMES.map((theme) => theme.key), ["default-dark", "red-dark", "default-light", "pink-dark", "pink-light", "orange-dark", "orange-light", "green-dark", "green-light", "gray-dark", "gray-light", "kids-light"]);
  assert.equal(new Set(STUDENT_THEMES.map((theme) => theme.key)).size, STUDENT_THEMES.length);
});

test("unknown persisted themes safely fall back to the default", () => {
  assert.equal(normalizeStudentTheme("red-dark"), "red-dark");
  assert.equal(normalizeStudentTheme("removed-theme"), DEFAULT_STUDENT_THEME);
  assert.equal(normalizeStudentTheme(null), DEFAULT_STUDENT_THEME);
});
