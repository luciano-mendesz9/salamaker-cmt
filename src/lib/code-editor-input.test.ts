import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedCodeEditorChange } from "./code-editor-input";

test("blocks mobile paste even without a paste event", () => {
  assert.equal(isBlockedCodeEditorChange("void loop() {\n  \n}", "void loop() {\n  digitalWrite(13, HIGH);\n}", "insertText"), true);
  assert.equal(isBlockedCodeEditorChange("abc", "xyzabc", undefined), true);
  assert.equal(isBlockedCodeEditorChange("abc", "xabc", "insertFromPaste"), true);
});

test("keeps ordinary typing, replacement, deletion and IME composition usable", () => {
  assert.equal(isBlockedCodeEditorChange("abc", "abxc", "insertText"), false);
  assert.equal(isBlockedCodeEditorChange("abc", "axc", "insertText"), false);
  assert.equal(isBlockedCodeEditorChange("abc", "ac", "deleteContentBackward"), false);
  assert.equal(isBlockedCodeEditorChange("abc", "abçc", "insertCompositionText"), false);
});
