import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export const Badge = ({ className, ...props }: BadgeProps) => (
  <span className={cn("status-chip", className)} {...props} />
);
