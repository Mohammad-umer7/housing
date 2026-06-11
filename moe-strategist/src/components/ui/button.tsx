import * as React from "react"

type ButtonVariant = 'default' | 'ghost' | 'outline' | 'secondary'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const getVariantClass = (variant?: ButtonVariant) => {
  switch (variant) {
    case 'ghost':
      return 'hover:bg-accent hover:text-accent-foreground'
    case 'outline':
      return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
    case 'secondary':
      return 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    case 'default':
    default:
      return 'bg-primary text-primary-foreground hover:bg-primary/90'
  }
}

const getSizeClass = (size?: ButtonSize) => {
  switch (size) {
    case 'sm':
      return 'h-9 px-3 text-xs'
    case 'lg':
      return 'h-11 px-8 text-base'
    case 'icon':
      return 'h-10 w-10 p-0'
    case 'default':
    default:
      return 'h-10 px-4 py-2 text-sm'
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${getVariantClass(variant)} ${getSizeClass(size)} ${className || ''}`}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button }
