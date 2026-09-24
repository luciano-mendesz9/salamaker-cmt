import type { StaticImageData } from "next/image";
import avatarDefault from "@/assets/profiles/default.webp";
import avatar001 from "@/assets/profiles/001.webp";
import avatar002 from "@/assets/profiles/002.webp";
import avatar003 from "@/assets/profiles/003.webp";
import avatar004 from "@/assets/profiles/004.webp";
import avatar005 from "@/assets/profiles/005.webp";
import avatar006 from "@/assets/profiles/006.webp";
import avatar007 from "@/assets/profiles/007.webp";
import avatar008 from "@/assets/profiles/008.webp";
import avatar009 from "@/assets/profiles/009.webp";
import avatar010 from "@/assets/profiles/010.webp";
import avatar011 from "@/assets/profiles/011.webp";
import avatar012 from "@/assets/profiles/012.webp";
import avatar013 from "@/assets/profiles/013.webp";
import avatar014 from "@/assets/profiles/014.webp";
import avatar015 from "@/assets/profiles/015.webp";
import avatar016 from "@/assets/profiles/016.webp";
import avatar017 from "@/assets/profiles/017.webp";
import avatar018 from "@/assets/profiles/018.webp";
import avatar019 from "@/assets/profiles/019.webp";
import avatar020 from "@/assets/profiles/020.webp";
import avatar021 from "@/assets/profiles/021.webp";
import avatar022 from "@/assets/profiles/022.webp";
import avatar023 from "@/assets/profiles/023.webp";
import avatar024 from "@/assets/profiles/024.webp";
import avatar025 from "@/assets/profiles/025.webp";
import avatar026 from "@/assets/profiles/026.webp";
import avatar027 from "@/assets/profiles/027.webp";
import avatar028 from "@/assets/profiles/028.webp";
import avatar029 from "@/assets/profiles/029.webp";
import avatar030 from "@/assets/profiles/030.webp";
import avatar031 from "@/assets/profiles/031.webp";
import avatar032 from "@/assets/profiles/032.webp";
import avatar033 from "@/assets/profiles/033.webp";
import avatar034 from "@/assets/profiles/034.webp";
import avatar035 from "@/assets/profiles/035.webp";
import avatar036 from "@/assets/profiles/036.webp";
import avatar037 from "@/assets/profiles/037.webp";
import avatar038 from "@/assets/profiles/038.webp";
import avatar039 from "@/assets/profiles/039.webp";
import avatar040 from "@/assets/profiles/040.webp";

export const PROFILE_AVATARS = [
  { key: "default", image: avatarDefault },
  { key: "001", image: avatar001 }, { key: "002", image: avatar002 },
  { key: "003", image: avatar003 }, { key: "004", image: avatar004 },
  { key: "005", image: avatar005 }, { key: "006", image: avatar006 },
  { key: "007", image: avatar007 }, { key: "008", image: avatar008 },
  { key: "009", image: avatar009 }, { key: "010", image: avatar010 },
  { key: "011", image: avatar011 }, { key: "012", image: avatar012 },
  { key: "013", image: avatar013 }, { key: "014", image: avatar014 },
  { key: "015", image: avatar015 }, { key: "016", image: avatar016 },
  { key: "017", image: avatar017 }, { key: "018", image: avatar018 },
  { key: "019", image: avatar019 }, { key: "020", image: avatar020 },
  { key: "021", image: avatar021 }, { key: "022", image: avatar022 },
  { key: "023", image: avatar023 }, { key: "024", image: avatar024 },
  { key: "025", image: avatar025 }, { key: "026", image: avatar026 },
  { key: "027", image: avatar027 }, { key: "028", image: avatar028 },
  { key: "029", image: avatar029 }, { key: "030", image: avatar030 },
  { key: "031", image: avatar031 }, { key: "032", image: avatar032 },
  { key: "033", image: avatar033 }, { key: "034", image: avatar034 },
  { key: "035", image: avatar035 }, { key: "036", image: avatar036 },
  { key: "037", image: avatar037 }, { key: "038", image: avatar038 },
  { key: "039", image: avatar039 }, { key: "040", image: avatar040 },
] as const satisfies ReadonlyArray<{ key: string; image: StaticImageData }>;

export type ProfileAvatarKey = (typeof PROFILE_AVATARS)[number]["key"];
export const PROFILE_AVATAR_KEYS = PROFILE_AVATARS.map(({ key }) => key) as [ProfileAvatarKey, ...ProfileAvatarKey[]];

const profileAvatarImages = new Map<string, StaticImageData>(PROFILE_AVATARS.map(({ key, image }) => [key, image]));

export function getProfileAvatar(key: string | null | undefined) {
  return profileAvatarImages.get(key ?? "default") ?? avatarDefault;
}
