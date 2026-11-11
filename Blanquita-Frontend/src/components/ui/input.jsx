import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({
  className,
  type,
  value,
  ...props
}) {
  const safeValue = (typeof value === "number" && Number.isNaN(value)) || value === null || value === undefined ? "" : value;
  return (
    <InputPrimitive
      type={type}
      value={safeValue}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props} />
  );
}

export { Input }
