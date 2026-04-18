import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-[#AFAFAF] focus-visible:border-[#93d333] focus-visible:border-b-4 aria-invalid:border-[#FF4B4B] aria-invalid:text-[#FF4B4B] dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-xl border-2 border-[#E5E5E5] bg-white px-3 py-2 text-base shadow-none transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
