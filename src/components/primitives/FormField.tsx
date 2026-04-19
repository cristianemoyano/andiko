import * as Label from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

function FormField({ label, htmlFor, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label.Root
        htmlFor={htmlFor}
        className="text-[12px] font-medium text-zinc-600"
      >
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden>*</span>}
      </Label.Root>

      {children}

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export { FormField }
