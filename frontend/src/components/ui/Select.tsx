import type { SelectHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = ({ className, ...props }: SelectProps) => (
  <select className={cn("select", className)} {...props} />
);
