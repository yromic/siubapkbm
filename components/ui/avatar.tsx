/**
 * Avatar — User/entity avatar with initials fallback.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §5 Rule 4.2 (brand-emerald brand accent)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 Rule 3.3 (rounded-full for circular elements)
 *
 * Usage:
 *   <Avatar name="Amirul Hadi" size="md" />
 *   <Avatar name="Bu Siti" src="/avatars/siti.jpg" size="lg" />
 *   <AvatarGroup users={[{ name: "A" }, { name: "B" }]} max={3} />
 */

import React from "react";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  /** Full name or label — initials are derived from the first two words */
  name: string;
  /** Optional image URL */
  src?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Derives a consistent background color from the name string.
 * Keeps color within the brand palette range for visual coherence.
 */
function getAvatarColor(name: string): string {
  const COLORS = [
    "bg-brand-emerald-100 text-brand-emerald-700 dark:bg-brand-emerald-950/40 dark:text-brand-emerald-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);

  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      className={[
        "rounded-full flex-shrink-0 overflow-hidden",
        "flex items-center justify-center",
        "font-plus-jakarta font-bold select-none",
        "ring-2 ring-white dark:ring-zinc-900",
        SIZE_CLASSES[size],
        src ? "bg-zinc-100 dark:bg-zinc-800" : colorClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if image fails to load
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AvatarGroup
// ─────────────────────────────────────────────

export interface AvatarGroupProps {
  users: Array<{ name: string; src?: string }>;
  /** Maximum number of avatars to show before overflow indicator */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({
  users,
  max = 4,
  size = "sm",
  className = "",
}: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div
      className={`flex items-center -space-x-2 ${className}`}
      role="group"
      aria-label={`${users.length} pengguna`}
    >
      {visible.map((user, i) => (
        <Avatar key={i} name={user.name} src={user.src} size={size} />
      ))}
      {overflow > 0 && (
        <div
          aria-label={`${overflow} pengguna lainnya`}
          className={[
            "rounded-full flex-shrink-0",
            "flex items-center justify-center",
            "font-plus-jakarta font-bold text-zinc-500 dark:text-zinc-400",
            "bg-zinc-100 dark:bg-zinc-800",
            "ring-2 ring-white dark:ring-zinc-900",
            "text-[10px]",
            SIZE_CLASSES[size],
          ].join(" ")}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
