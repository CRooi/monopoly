import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        red:
          "border border-[#a8261c] bg-[linear-gradient(180deg,#ec5a4d,#d63c2f)] text-white font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#a8261c] hover:brightness-105 active:translate-y-px active:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_0_#a8261c]",
        gold:
          "border border-[#c99400] bg-[linear-gradient(180deg,#ffd43b,#f2b705)] text-ink font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_2px_0_#c99400] hover:brightness-105 active:translate-y-px active:shadow-[0_1px_0_#c99400]",
        green:
          "border border-[#17703c] bg-[linear-gradient(180deg,#34a865,#1f8a4c)] text-white font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#17703c] hover:brightness-105 active:translate-y-px active:shadow-[0_1px_0_#17703c]",
        blue:
          "border border-[#154ea0] bg-[linear-gradient(180deg,#3d82e0,#1c63c9)] text-white font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_0_#154ea0] hover:brightness-105 active:translate-y-px active:shadow-[0_1px_0_#154ea0]",
        paper:
          "border border-[#d9ccad] bg-[linear-gradient(180deg,#ffffff,#f6efdf)] text-ink font-medium shadow-[0_2px_0_#d9ccad] hover:bg-[#fffaf0] active:translate-y-px active:shadow-[0_1px_0_#d9ccad]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        xl: "h-12 gap-2 rounded-xl px-6 text-lg tracking-widest [&_svg:not([class*='size-'])]:size-5",
        lg2: "h-10 gap-1.5 rounded-xl px-4 text-base tracking-wide",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
