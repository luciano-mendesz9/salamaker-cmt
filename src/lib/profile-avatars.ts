import type { StaticImageData } from "next/image";
import { GENERATED_PROFILE_AVATARS } from "@/lib/profile-avatar-assets.generated";

export const PROFILE_AVATARS = GENERATED_PROFILE_AVATARS;
export type ProfileAvatarKey = (typeof PROFILE_AVATARS)[number]["key"];
export const PROFILE_AVATAR_KEYS = PROFILE_AVATARS.map(({ key }) => key) as [ProfileAvatarKey, ...ProfileAvatarKey[]];

const profileAvatarImages = new Map<string, StaticImageData>(PROFILE_AVATARS.map(({ key, image }) => [key, image]));

export function getProfileAvatar(key: string | null | undefined) {
  return profileAvatarImages.get(key ?? "default") ?? PROFILE_AVATARS[0].image;
}
