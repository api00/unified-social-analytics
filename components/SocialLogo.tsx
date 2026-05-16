import { siInstagram, siTiktok, siYoutube } from "simple-icons";
import type { CSSProperties } from "react";
import { getPlatformId, isSocialPlatformId, socialBrandList, socialBrands } from "../data/socials";

const socialIcons = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
};

export default function SocialLogo({
  className = "",
  platform,
  size = 16,
}: {
  className?: string;
  platform: string;
  size?: number;
}) {
  const platformId = getPlatformId(platform);
  if (!isSocialPlatformId(platformId)) return null;

  const icon = socialIcons[platformId];
  const brand = socialBrands[platformId];

  if (!icon || !brand) return null;

  return (
    <span
      aria-hidden="true"
      className={`social-logo social-logo--${platformId} ${className}`}
      style={{ "--logo-size": `${size}px` } as CSSProperties}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d={icon.path} />
      </svg>
    </span>
  );
}

export function SocialLogoGroup() {
  return (
    <span aria-hidden="true" className="social-logo-group">
      {socialBrandList.map((platform) => (
        <SocialLogo key={platform} platform={platform} size={13} />
      ))}
    </span>
  );
}
