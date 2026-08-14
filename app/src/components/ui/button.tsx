import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Every filled call to action is blue. `primary` and `solid` are the same
 * #1D428A, and the difference between them is now what the markup says about
 * the button rather than what it looks like.
 *
 * They used to be red and black: red for the one button that finishes what the
 * screen is for (add to cart, checkout, pay), black for everything else with
 * weight. The shop's call is that the thing to press is the institutional blue —
 * the colour already carrying the nav row and the focus ring — everywhere, not
 * only on the buying path. So a customer never has to learn that a black button
 * and a red one are both things they may press.
 *
 * The hierarchy that red-vs-black used to carry has to come from somewhere else,
 * and it comes from `outline` and `ghost`: one filled blue button per block,
 * everything secondary bordered or grey. Two blue buttons side by side is the
 * same bug two reds were.
 *
 * `sale` stays red, because red no longer means action at all — it means money
 * off, and it lends that weight to the destructive confirm.
 */
type Variant = "primary" | "solid" | "outline" | "ghost" | "sale" | "inverse";
type Size = "sm" | "md" | "lg";

/*
  The label is body-face, not display.

  Every heading on this site is condensed caps, and a button whose label is drawn
  the same way reads as a small heading that happens to be clickable. `design.md`
  §3 splits them deliberately: condensed above, normal below, and the CTA in caps
  with the tracking opened up to .06em. That contrast — compressed heading,
  wide-tracked label — is most of what makes the system recognisable, and it is
  lost if the button joins the headings.
*/
const BASE =
  "inline-flex items-center justify-center gap-2 font-sans font-bold uppercase leading-none tracking-cta transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

/*
  No variant hovers into another variant's colour.

  Black-hovering-to-red was the site's default button, which put the discount
  colour under the pointer on every control it had — including "view all" and
  "back to the catalogue", neither of which is an action red is allowed to
  describe. Each variant hovers within its own register: blue deepens, outline
  fills black, red darkens 12%.

  `outline` keeps its black border rather than turning blue too. It is the
  *second* choice next to a blue button, and a blue outline beside a blue fill
  is two of the same colour arguing about which one is the action.
*/
const VARIANTS: Record<Variant, string> = {
  primary: "bg-court text-white hover:bg-court-deep",
  solid: "bg-court text-white hover:bg-court-deep",
  outline: "border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
  ghost: "bg-shell text-ink hover:bg-shell-deep",
  sale: "bg-flame text-white hover:bg-flame-deep",
  inverse: "bg-white text-ink hover:bg-shell-deep",
};

/*
  `md` and `lg` clear the 48px the spec asks for. `sm` does not, and is for the
  dense admin rows and inline form controls rather than for anything a shopper
  has to hit on a phone.
*/
const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.8125rem]",
  md: "h-12 px-6 text-[0.9375rem]",
  lg: "h-14 px-8 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = "solid",
  size = "md",
  block,
  className,
  children,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "solid",
  size = "md",
  block,
  className,
  children,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
