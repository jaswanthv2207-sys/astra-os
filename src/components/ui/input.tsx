"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type InputSize = "sm" | "md" | "lg";

const sizeClasses: Record<InputSize, string> = {
  sm: "h-9 text-sm",
  md: "h-10",
  /* 16px also stops iOS Safari auto-zooming on focus (<16px triggers it). */
  lg: "h-12 text-base",
};

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  /** Visible label. Omit only when an `aria-label` is already provided. */
  label?: React.ReactNode;
  /** Helper text rendered under the field (ids are wired automatically). */
  hint?: React.ReactNode;
  /** Error text — switches `aria-invalid`, border and ring to `danger`. */
  error?: React.ReactNode;
  /** Leading icon (decorative — set `aria-hidden` in the wrapper). */
  icon?: React.ReactNode;
  /** Trailing slot, e.g. a kbd hint or clear button. */
  trailing?: React.ReactNode;
  size?: InputSize;
  /** Class for the focusable wrapper (label/input wrapper layout). */
  wrapperClassName?: string;
}

/**
 * Input — text field with a designed focus state.
 *
 * Micro-interactions: the *wrapper* reacts to `focus-within` with an aura
 * border, a soft glow ring and a slightly brighter fill; invalid fields
 * shift to the danger tokens instead.
 *
 * A11y:
 * • `<label>` is bound via generated id (or your own `id`)
 * • `aria-invalid` + `aria-describedby` wire hint/error text automatically
 * • the native outline on the input is replaced by the wrapper's ring —
 *   focus indication is stronger, never hidden
 *
 * @example
 * <Input label="Email" type="email" placeholder="you@astra.dev" hint="We never share it." />
 * <Input label="Passphrase" type="password" error="Too short — 12 characters minimum." />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      label,
      hint,
      error,
      icon,
      trailing,
      size = "md",
      id: idProp,
      disabled,
      required,
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const id = idProp ?? reactId;
    const hintId = `${id}-hint`;
    const describedBy =
      [error ? hintId : null, !error && hint ? hintId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("flex w-full flex-col gap-2", wrapperClassName)}>
        {label && (
          <label
            htmlFor={id}
            className="text-ink flex items-baseline gap-1 text-sm font-medium"
          >
            {label}
            {required && (
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            )}
          </label>
        )}

        <div
          className={cn(
            "group/input backdrop-blur-glass shadow-inner-highlight flex items-center gap-2.5 rounded-lg border bg-white/[0.03] px-3",
            "duration-base ease-out-expo transition-all",
            error
              ? "border-danger/60 focus-within:border-danger focus-within:bg-danger-dim focus-within:shadow-ring-danger"
              : "border-line hover:border-line-strong focus-within:border-aura-violet/70 focus-within:shadow-ring-aura focus-within:bg-white/[0.06]",
            disabled && "pointer-events-none opacity-50",
            sizeClasses[size],
            className,
          )}
        >
          {icon && (
            <span
              aria-hidden="true"
              className="text-ink-faint duration-base group-focus-within/input:text-aura-violet shrink-0 transition-colors"
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "text-ink placeholder:text-ink-ghost h-full w-full min-w-0 bg-transparent outline-none",
              "read-only:cursor-default focus-visible:outline-none",
            )}
            {...props}
          />

          {trailing && (
            <div className="flex shrink-0 items-center">{trailing}</div>
          )}
        </div>

        {(hint || error) && (
          <p
            id={hintId}
            className={cn(
              "text-xs leading-relaxed",
              error ? "text-danger" : "text-ink-faint",
            )}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
