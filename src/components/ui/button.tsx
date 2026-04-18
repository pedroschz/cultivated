import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[16px] text-sm font-bold uppercase tracking-wide transition-[colors,opacity,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:transition-none origin-bottom",
  {
    variants: {
      variant: {
        default:
          "bg-[#93d333] text-white dark:text-[#131f24] border-0 border-b-[4px] border-b-[#79b933] active:-translate-y-[0.2px] active:scale-y-[0.909] active:border-b-0 hover:bg-[#95DF26]",
        destructive:
          "bg-[#FF4B4B] text-white border-0 border-b-[4px] border-b-[#D43F3F] active:-translate-y-[0.2px] active:scale-y-[0.909] active:border-b-0 hover:bg-[#FF6464]",
        outline:
          "bg-white dark:bg-card text-[#4B4B4B] dark:text-foreground border-2 border-[#E5E5E5] dark:border-border border-b-[4px] active:-translate-y-[0.2px] active:scale-y-[0.909] active:border-b-0 hover:bg-[#F7F7F7] dark:hover:bg-accent",
        secondary:
          "bg-[#1CB0F6] text-white border-0 border-b-[4px] border-b-[#1899D6] active:-translate-y-[0.2px] active:scale-y-[0.909] active:border-b-0 hover:bg-[#40C3FF]",
        ghost:
          "bg-transparent text-[#4B4B4B] dark:text-foreground hover:bg-[#E5E5E5]/50 dark:hover:bg-accent border-transparent",
        link: "text-[#1CB0F6] underline-offset-4 hover:underline",
        // Super/Gold variant often used in Duolingo
        super: 
          "bg-[#FFC800] text-[#4B4B4B] border-0 border-b-[4px] border-b-[#D9AA00] active:-translate-y-[0.2px] active:scale-y-[0.909] active:border-b-0 hover:bg-[#FFD433]",
      },
      size: {
        default: "h-11 px-6 py-2 has-[>svg]:px-4", // Taller standard button
        sm: "h-9 rounded-2xl px-4 text-xs border-b-[3px] active:-translate-y-[0.2px] active:scale-y-[0.889] active:border-b-0",
        lg: "h-[48px] rounded-[16px] px-8 text-[17px] active:scale-y-[0.917]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
