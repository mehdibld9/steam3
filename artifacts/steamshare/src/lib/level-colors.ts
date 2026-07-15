export function getLevelColor(level: number): string {
  const tier = Math.floor((level - 1) / 10);
  const colors = [
    "#94a3b8",
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#f97316",
    "#eab308",
    "#ef4444",
    "#ec4899",
    "#06b6d4",
    "#f59e0b", // tier 9: Immortal (91-100) — amber gold
    "#a78bfa", // tier 10: Transcendent (101-110) — violet
    "#f43f5e", // tier 11: Godlike (111-120) — rose
    "#34d399", // tier 12: Eternal (121-130) — emerald
  ];
  return colors[Math.min(tier, colors.length - 1)];
}

export function getLevelLabel(level: number): string {
  const tier = Math.floor((level - 1) / 10);
  const labels = [
    "Newcomer",
    "Rookie",
    "Regular",
    "Veteran",
    "Expert",
    "Elite",
    "Master",
    "Legend",
    "Mythic",
    "Immortal",
    "Transcendent",
    "Godlike",
    "Eternal",
  ];
  return labels[Math.min(tier, labels.length - 1)];
}
