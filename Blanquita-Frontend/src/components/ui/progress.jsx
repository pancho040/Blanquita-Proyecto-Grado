import * as React from "react"

const Progress = React.forwardRef(({ className = "", value = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={`relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}
    {...props}
  >
    <div
      className="h-full w-full flex-1 bg-blue-600 transition-all dark:bg-blue-500"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
