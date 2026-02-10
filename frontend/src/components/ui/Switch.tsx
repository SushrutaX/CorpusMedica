import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label?: string;
};

export const Switch = ({ className, label, ...props }: SwitchProps) => (
  <label className={cn("toggle", className)}>
    <input type="checkbox" {...props} />
    <span />
    {label ? <span className="sr-only">{label}</span> : null}
  </label>
);
