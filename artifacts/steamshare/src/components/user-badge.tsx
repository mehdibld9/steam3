interface UserBadgeProps {
  badgeType?: string | null;
  size?: number;
}

export const BADGE_OPTIONS = [
  { key: "gold",    label: "Gold",     emoji: "🥇", title: "Premium Member",  pro: false },
  { key: "star",    label: "Star",     emoji: "⭐", title: "Premium Star",     pro: false },
  { key: "vip",     label: "VIP",      emoji: "💎", title: "Pro VIP",          pro: true  },
  { key: "crown",   label: "Crown",    emoji: "👑", title: "Pro Crown",        pro: true  },
  { key: "fire",    label: "Fire",     emoji: "🔥", title: "Pro Fire",         pro: true  },
  { key: "shield",  label: "Shield",   emoji: "🛡️",  title: "Pro Shield",       pro: true  },
  { key: "diamond", label: "Diamond",  emoji: "💠", title: "Pro Diamond",      pro: true  },
  { key: "bolt",    label: "Bolt",     emoji: "⚡", title: "Pro Bolt",         pro: true  },
];

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

  const option = BADGE_OPTIONS.find((b) => b.key === badgeType);
  if (!option) return null;

  return (
    <span
      title={option.title}
      style={{ fontSize: size, lineHeight: 1, display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      {option.emoji}
    </span>
  );
}
