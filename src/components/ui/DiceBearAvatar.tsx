"use client";

interface DiceBearAvatarProps {
  style: string;
  seed: string;
  size?: number;
  className?: string;
  round?: boolean;
}

export default function DiceBearAvatar({
  style,
  seed,
  size = 40,
  className = "",
  round = true,
}: DiceBearAvatarProps) {
  const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      width={size}
      height={size}
      alt="Avatar"
      className={className}
      style={{ borderRadius: round ? "50%" : undefined, display: "block", flexShrink: 0 }}
    />
  );
}
