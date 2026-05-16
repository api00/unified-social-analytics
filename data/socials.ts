import type { SocialPlatformId } from "../types/analytics";

export const socialBrands: Record<SocialPlatformId, { chartColor: string; label: string; softColor: string }> = {
  youtube: {
    chartColor: "#ff0000",
    label: "YouTube",
    softColor: "#fff0f0",
  },
  tiktok: {
    chartColor: "#111111",
    label: "TikTok",
    softColor: "#f1f5f9",
  },
  instagram: {
    chartColor: "#ff0069",
    label: "Instagram",
    softColor: "#fff0f7",
  },
};

export const socialBrandList: SocialPlatformId[] = ["youtube", "tiktok", "instagram"];

export function getPlatformId(platform: unknown) {
  return String(platform).toLowerCase();
}

export function isSocialPlatformId(platform: unknown): platform is SocialPlatformId {
  return platform === "youtube" || platform === "tiktok" || platform === "instagram";
}

export function getSocialBrand(platform: unknown) {
  const platformId = getPlatformId(platform);
  return isSocialPlatformId(platformId) ? socialBrands[platformId] : null;
}

export function getPlatformColor(platform: unknown) {
  return getSocialBrand(platform)?.chartColor ?? "#315be8";
}
