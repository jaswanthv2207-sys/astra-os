"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";

const ModalRoot = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;
const ModalTitle = DialogPrimitive.Title;
const ModalDescription = DialogPrimitive.Description;

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[calc(100vw-2rem)]",
};

/** Decorative keyboard hint (announced only through the dialog's a11y tree). */
function EscHint() {
  return (
    <span
      aria-hidden="true"
      className="tracking-caps text-ink-ghost text-micro flex items-center gap-1.5 uppercase"
    >
      <kbd className="border-line rounded border bg-white/[0.05] px-1.5 py-0.5 font-sans normal-case">
        Esc
      </kbd>
      to close
    </span>
  );
}

export interface ModalProps {
  /** Open state (controlled). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Renders the trigger element (single child) that receives focus back. */
  trigger?: React.ReactNode;
  title: React.ReactNode;
  /** Optional visible description — also bound to `aria-describedby`. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  className?: string;
  /** Hide the top-right close button (provide your own instead). */
  hideClose?: boolean;
}

/**
 * Modal — Radix Dialog dressed in Astra OS glass.
 *
 * Why Radix: focus trap, `Esc` to dismiss, overlay click, scroll lock,
 * focus restore to trigger, correct `role="dialog"` / `aria-modal` /
 * `aria-describedby` wiring — all of it for free and keyboard-perfect.
 *
 * Micro-interactions: overlay blurs in while the panel scales up from 95%
 * with a spring (`tw-animate-css`); the close button blooms on hover.
 *
 * A11y:
 * • title is mandatory (falls back to a sr-only description if omitted)
 * • `Esc` hint is rendered for sighted keyboard users
 * • overlay is `aria-hidden`, panel is a labelled dialog landmark
 *
 * @example
 * <Modal title="Delete workspace" description="This cannot be undone."
 *        footer={<><Button variant="ghost">Cancel</Button><Button variant="danger">Delete</Button></>}>
 *   …body…
 * </Modal>
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  hideClose = false,
}: ModalProps) {
  return (
    <ModalRoot open={open} onOpenChange={onOpenChange}>
      {trigger && <ModalTrigger asChild>{trigger}</ModalTrigger>}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-modal data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 bg-black/60 backdrop-blur-sm motion-reduce:animate-none" />

        <DialogPrimitive.Content
          /* Radix omits `aria-modal`; assistive tech still needs the
             "modal dialog" announcement. Radix's own labelledby/describedby
             stay untouched (it spreads our props after its computed ids). */
          aria-modal="true"
          className={cn(
            "z-modal fixed top-1/2 left-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
            "rounded-glass flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden",
            "glass-strong outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4",
            "motion-reduce:animate-none motion-reduce:data-[state=open]:opacity-100",
            sizeClasses[size],
            className,
          )}
        >
          {/* header */}
          <div className="border-hairline flex items-start gap-4 border-b px-6 pt-6 pb-5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <ModalTitle className="tracking-title text-ink text-lg font-semibold">
                {title}
              </ModalTitle>
              <ModalDescription className={cn(!description && "sr-only")}>
                {description ?? title}
              </ModalDescription>
            </div>

            {!hideClose && (
              <ModalClose
                aria-label="Close dialog"
                className={cn(
                  "text-ink-faint -m-1.5 rounded-full p-1.5 outline-none",
                  "duration-fast ease-out-expo transition-all",
                  "hover:text-ink hover:rotate-90 hover:bg-white/10",
                  "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-2",
                )}
              >
                <Icon name="close" size="sm" />
              </ModalClose>
            )}
          </div>

          {/* body */}
          <div className="text-ink-muted flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed">
            {children}
          </div>

          {/* footer */}
          {footer && (
            <div className="border-hairline flex flex-wrap items-center justify-between gap-3 border-t bg-white/[0.02] px-6 py-4">
              <EscHint />
              <div className="flex flex-wrap items-center justify-end gap-3">
                {footer}
              </div>
            </div>
          )}

          {/* keyboard hint for sighted users */}
          {!footer && (
            <div className="pointer-events-none absolute bottom-3 left-6">
              <EscHint />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </ModalRoot>
  );
}

/**
 * Standalone description for cases where the dialog copy lives in `children`
 * — prevents Radix's "missing Description" accessibility warning while
 * keeping it invisible to screen readers only when intentionally decorative.
 */
export function ModalSrDescription({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Description className="sr-only">
      {children}
    </DialogPrimitive.Description>
  );
}

export { ModalRoot, ModalTrigger, ModalClose, ModalTitle, ModalDescription };
