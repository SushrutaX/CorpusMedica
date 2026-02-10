import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...props }: InputProps) => (
  <input className={cn("input", className)} {...props} />
);
