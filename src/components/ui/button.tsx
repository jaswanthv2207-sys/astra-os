"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/**
 * Button — the primary action primitive.
 *
 * Visual contract (all from the token layer):
 * • `primary` uses `bg-cta` (white label ≥ 4.5:1 across the whole gradient)
 *   and sweeps the gradient right on hover via `bg-cta-end`.
 * • every variant carries a light sheen that wipes across on hover, a lift on
 *   hover, a springy press, and an unmissable focus ring.
 *
 * A11y:
 * • defaults to `type="button"` so it never submits forms by accident
 * • `loading` announces `aria-busy` and swaps in a spinner (reduced-motion
 *   users get the tokenised `animate-spin` disabled by base.css)
 * • focus is never removed — only re-drawn as `outline-2` on-brand
 * • `asChild` delegates props to its single child (Radix `Slot`), so
 *   `<Button asChild><a …/></Button>` stays a real link for crawlers/AT
 *
 * @example
 * <Button variant="primary" size="lg" iconRight={<ArrowRight />}>Launch</Button>
 * <Button asChild variant="ghost"><Link href="/docs">Docs</Link></Button>
 */
const buttonVariants = cva(
  [
    // structure + motion baseline
    "group relative isolate inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap overflow-hidden rounded-lg font-medium",
    "transition-all duration-base ease-out-expo outline-none",
    // focus (base.css draws a violet outline; tighten it to the pill shape)
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura-violet",
    // press
    "active:scale-[0.97] motion-reduce:transform-none",
    // disabled
    "disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50",
    // icons follow the tokenised icon ramp with the button size, never shrink
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    // hover sheen: sits behind the label (isolate + -z-10), wipes left → right
    "before:absolute before:inset-y-0 before:-left-1/2 before:-z-10 before:w-1/2 before:content-[''] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-slow before:ease-out-expo hover:before:translate-x-[300%] motion-reduce:before:hidden",
  ].join(" "),
  {
    variants: {
      /* NOTE: `size` is declared before `variant` on purpose — cva emits in
         key order, so size-scaled classes (h-10, px-5) land first and the
         `link` variant's `h-auto p-0` can win the twMerge conflict. */
      size: {
        xs: "h-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg]:icon-xs",
        sm: "h-9 gap-1.5 rounded-lg px-3.5 text-sm [&_svg]:icon-sm",
        md: "h-10 px-5 text-sm [&_svg]:icon-sm",
        lg: "h-12 rounded-xl px-7 text-base [&_svg]:icon-md",
        icon: "size-10 rounded-lg p-0 [&_svg]:icon-md",
        "icon-sm": "size-8 rounded-md p-0 [&_svg]:icon-sm",
      },
      variant: {
        /** Aura CTA: gradient sweep + violet glow. */
        primary: [
          "bg-cta text-on-aura shadow-glow-violet brightness-100",
          "border border-white/15",
          "hover:-translate-y-0.5 hover:bg-cta-end hover:shadow-glow-aura hover:brightness-110",
          "focus-visible:outline-aura-cyan",
        ].join(" "),
        /**
         * "Launch Universe" — a deep-space CTA: aurora gradient border,
         * starfield-ish fill and a brighter halo on hover. Distinguished
         * from `primary` so the cinematic entry reads as a separate class
         * of action, not another conversion button.
         */
        cosmic: [
          "relative overflow-hidden border border-transparent text-ink",
          "bg-[linear-gradient(var(--surface-glass-strong),var(--surface-glass-strong))_padding-box,var(--gradient-aura)_border-box]",
          "shadow-glow-violet backdrop-blur-glass",
          "hover:-translate-y-0.5 hover:shadow-glow-aura hover:brightness-115",
          "focus-visible:outline-aura-cyan disabled:brightness-75",
        ].join(" "),
        /** Vision Pro material button. */
        glass: [
          "glass text-ink",
          "hover:-translate-y-0.5 hover:border-line-strong hover:bg-white/[0.09] hover:shadow-glass",
        ].join(" "),
        /** Transparent, defined by its hairline. */
        outline: [
          "border border-line-strong bg-transparent text-ink",
          "hover:-translate-y-0.5 hover:border-aura-violet/60 hover:bg-white/[0.05] hover:shadow-glow-violet",
        ].join(" "),
        /** Low-emphasis filler action. */
        ghost: [
          "bg-transparent text-ink-muted",
          "hover:bg-white/[0.06] hover:text-ink before:hidden",
          "focus-visible:outline-aura-violet",
        ].join(" "),
        /** Destructive / alert. Dark label keeps contrast ~9:1 on rose. */
        danger: [
          "bg-danger text-ink-inverse border border-white/15",
          "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-glow-danger",
          "focus-visible:outline-danger",
        ].join(" "),
        /** Inline text action. */
        link: [
          "h-auto rounded-none bg-transparent p-0 text-aura-violet underline-offset-4 before:hidden",
          "hover:underline focus-visible:outline-offset-4",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">,
    VariantProps<typeof buttonVariants> {
  /** Render the element of the single child instead of a `<button>`. */
  asChild?: boolean;
  /** Swaps the leading icon for a spinner and sets `aria-busy`. */
  loading?: boolean;
  /** Node rendered before the label (hidden while `loading`). */
  iconLeft?: React.ReactNode;
  /** Node rendered after the label (hidden while `loading`). */
  iconRight?: React.ReactNode;
  /** Native button type — defaults to `"button"` (never submits forms). */
  type?: "button" | "submit" | "reset";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      iconLeft,
      iconRight,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    /* `asChild` must hand Radix Slot exactly ONE child node — the icon
       slots are folded into `children` by the caller in that mode. */
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={classes}
          aria-busy={loading || undefined}
          aria-disabled={disabled ? true : undefined}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {loading ? <Icon as={Loader2} className="animate-spin" /> : iconLeft}
        {children}
        {loading ? null : iconRight}
      </button>
    );
  },
);

Button.displayName = "Button";

export { buttonVariants };
