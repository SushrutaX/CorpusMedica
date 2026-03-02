import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "ghost" | "accent";
type ButtonSize = "md" | "sm";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  default: "btn",
  ghost: "btn btn-ghost",
  accent: "btn btn-accent",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "",
  sm: "btn-small",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  )
);

Button.displayName = "Button";
