import assert from "node:assert/strict";
import test from "node:test";
import { profileAvatarPrice } from "./profile-avatar-pricing";

test("avatar price is 20% of current XP, rounded up to whole XP", () => {
  assert.equal(profileAvatarPrice(0), 0);
  assert.equal(profileAvatarPrice(1), 1);
  assert.equal(profileAvatarPrice(100), 20);
  assert.equal(profileAvatarPrice(103), 21);
});
