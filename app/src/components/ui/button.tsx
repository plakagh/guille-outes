import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "ghost" | "sale" | "inverse";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-display font-bold uppercase leading-none tracking-wide transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

const VARIANTS: Record<Variant, string> = {
  solid: "bg-ink text-white hover:bg-flame",
  outline: "border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
  ghost: "bg-shell text-ink hover:bg-shell-deep",
  sale: "bg-flame text-white hover:bg-flame-deep",
  inverse: "bg-white text-ink hover:bg-flame hover:text-white",
};

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
