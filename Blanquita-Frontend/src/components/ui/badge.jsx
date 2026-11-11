import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-transparent bg-slate-900 text-white",
        secondary: "border-slate-200 bg-slate-100 text-slate-800",
        destructive: "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]",
        outline: "border-slate-200 bg-white text-slate-800",
        success: "border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]",
        warning: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
        info: "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]",
        brand: "border-[#BAE6FD] bg-[#F0F9FF] text-[#1C96C5]",
        ghost: "border-transparent hover:bg-slate-100 text-slate-700",
        link: "border-transparent text-[#1C96C5] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps({
      className: cn(badgeVariants({ variant }), className),
    }, props),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants }
