"use client";

import * as React from "react";

import { Badge, Button, Input } from "@/components";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * WaitlistCta — the conversion moment.
 *
 * A glass panel lit by a slow animated aurora, the page's sharpest line of
 * copy, and a real (client-validated) email form that swaps to a success
 * state without a round-trip. Both hero CTAs anchor here.
 */
export function WaitlistCta() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();

    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email — that's where the invite goes.");
      return;
    }

    setError(null);
    setJoined(true);
  };

  return (
    <section
      id="waitlist"
      aria-labelledby="waitlist-title"
      className="container-page section-y scroll-mt-24"
    >
      <div className="border-line rounded-glass shadow-glass relative overflow-hidden border">
        {/* animated gradient wash + scrim */}
        <div
          aria-hidden="true"
          className="bg-aura animate-aurora absolute -inset-12 opacity-70 blur-3xl"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-16 text-center md:px-16">
          <span className="eyebrow">Early access</span>

          <h2
            id="waitlist-title"
            className="text-hero text-ink max-w-3xl font-semibold text-balance"
          >
            Stop searching. <span className="text-aurora">Start knowing.</span>
          </h2>

          <p className="text-lead text-ink-muted max-w-xl text-balance">
            Astra OS is in private beta. Join the list and we&apos;ll open your
            workspace within 48 hours.
          </p>

          {joined ? (
            <div className="animate-in fade-in-0 zoom-in-95 flex flex-col items-center gap-3">
              <Badge variant="success" size="lg" dot pulse>
                You&apos;re on the list
              </Badge>
              <p className="text-ink-muted text-sm">
                We&apos;ll email{" "}
                <span className="text-ink font-medium">{email.trim()}</span> the
                moment your workspace is ready.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:items-start"
            >
              <Input
                type="email"
                name="email"
                autoComplete="email"
                size="lg"
                aria-label="Work email"
                placeholder="you@company.com"
                value={email}
                error={error ?? undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                wrapperClassName="flex-1"
              />
              <Button type="submit" size="lg" variant="primary">
                Request access
              </Button>
            </form>
          )}

          {!joined && (
            <p className="text-ink-faint text-micro">
              One email, when your workspace is ready. Unsubscribe anytime.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
