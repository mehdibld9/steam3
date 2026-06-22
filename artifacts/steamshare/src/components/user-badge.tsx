interface UserBadgeProps {
  badgeType?: string | null;
  size?: number;
}

export function UserBadge({ badgeType, size = 16 }: UserBadgeProps) {
  if (!badgeType) return null;

  if (badgeType === "gold") {
    return (
      <img
        src="/badge-gold.png"
        alt="Premium"
        title="Premium Member"
        style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }}
      />
    );
  }

  if (badgeType === "vip") {
    return (
      <img
        src="/badge-vip.png"
        alt="Pro VIP"
        title="Pro VIP Member"
        style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }}
      />
    );
  }

  return null;
}
