import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-200" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        outline:
          "border [border-color:var(--button-outline)] shadow-xs active:shadow-none",
        secondary: "border bg-secondary text-secondary-foreground border border-secondary-border",
        ghost: "border border-transparent",
      },
      size: {
        // Material Design 3: Visual height 40dp with 48dp touch target minimum
        // xs: Extra small for badges/chips (not button)
        sm: "min-h-10 px-3 md:px-4 text-xs md:text-sm",
        // default: Standard button (40dp visual, 48dp touch)
        default: "min-h-12 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base",
        // lg: Large button for important actions
        lg: "min-h-12 px-6 md:px-8 py-3 md:py-4 text-base md:text-lg",
        // icon: Icon button (48x48dp Material Design standard)
        icon: "h-12 w-12 md:h-10 md:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
