"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

const styles = {
  base: "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none",
  variants: {
    primary:
      "text-white active:scale-[0.98]",
    ghost:
      "active:scale-[0.98]",
    danger:
      "text-white active:scale-[0.98]",
  },
  sizes: {
    sm: "h-8 px-3 text-xs",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
  },
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  className = "",
  style,
  ...props
}: ButtonProps) {
  const variantStyle =
    variant === "primary"
      ? {
          backgroundColor: "var(--color-primary)",
          ...style,
        }
      : variant === "danger"
      ? { backgroundColor: "var(--color-error)", ...style }
      : {
          backgroundColor: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-secondary)",
          ...style,
        };

  return (
    <button
      className={`
        ${styles.base}
        ${styles.variants[variant]}
        ${styles.sizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      style={variantStyle}
      disabled={loading || props.disabled}
      onMouseEnter={(e) => {
        if (variant === "primary") e.currentTarget.style.backgroundColor = "var(--color-primary-hover)";
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (variant === "primary") e.currentTarget.style.backgroundColor = "var(--color-primary)";
        props.onMouseLeave?.(e);
      }}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Entrando...
        </>
      ) : (
        children
      )}
    </button>
  );
}
