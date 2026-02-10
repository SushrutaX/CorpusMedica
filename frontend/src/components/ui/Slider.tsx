import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const Slider = ({ className, ...props }: SliderProps) => (
  <input type="range" className={cn("slider", className)} {...props} />
);
