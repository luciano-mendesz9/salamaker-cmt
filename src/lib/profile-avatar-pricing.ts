export function profileAvatarPrice(currentXp: number) {
  if (!Number.isInteger(currentXp) || currentXp < 0) throw new Error("INVALID_XP");
  return Math.ceil(currentXp / 5);
}
