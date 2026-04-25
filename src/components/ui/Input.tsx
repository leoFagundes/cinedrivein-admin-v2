"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, rightIcon, onRightIconClick, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span
              className="absolute left-3 flex items-center pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`
              w-full h-11 px-4 text-sm rounded-[var(--radius-md)] outline-none transition-all duration-200
              ${icon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              ${className}
            `}
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              border: `1px solid ${error ? "var(--color-error)" : "var(--color-border)"}`,
              color: "var(--color-text-primary)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = error
                ? "var(--color-error)"
                : "var(--color-border-focus)";
              e.currentTarget.style.boxShadow = error
                ? "0 0 0 3px rgba(239,68,68,0.1)"
                : "0 0 0 3px var(--color-primary-light)";
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error
                ? "var(--color-error)"
                : "var(--color-border)";
              e.currentTarget.style.boxShadow = "none";
              props.onBlur?.(e);
            }}
            {...props}
          />
          {rightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className="absolute right-3 flex items-center cursor-pointer"
              style={{ color: "var(--color-text-muted)" }}
            >
              {rightIcon}
            </button>
          )}
        </div>
        {error && (
          <span className="text-xs" style={{ color: "var(--color-error)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
