import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[#AFAFAF] selection:bg-[#93d333] selection:text-white dark:bg-input/30 border-2 border-[#E5E5E5] flex h-11 w-full min-w-0 rounded-xl bg-white px-3 py-1 text-base shadow-none transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-bold disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[#93d333] focus-visible:border-b-4", // Flat active state
        "aria-invalid:border-[#FF4B4B] aria-invalid:text-[#FF4B4B]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
