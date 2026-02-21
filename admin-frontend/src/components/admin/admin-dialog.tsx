/**
 * AdminDialog Component
 * Reusable dialog for creating/editing admin resources
 */

import * as React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type FieldConfig = {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'switch' | 'select' | 'array'
  placeholder?: string
  description?: string
  required?: boolean
  options?: { label: string; value: string }[] // For select type
  defaultValue?: unknown
  min?: number // For number type
  max?: number // For number type
}

export interface AdminDialogProps<T extends z.ZodObject<z.ZodRawShape>> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  schema: T
  defaultValues?: z.infer<T>
  fields: FieldConfig[]
  onSubmit: (data: z.infer<T>) => void
  isLoading?: boolean
  submitButtonText?: string
  className?: string
}

export function AdminDialog<T extends z.ZodObject<z.ZodRawShape>>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  fields,
  onSubmit,
  isLoading = false,
  submitButtonText = 'Save',
  className,
}: AdminDialogProps<T>) {
  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as z.infer<T>,
  })

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form])

  function handleSubmit(data: z.infer<T>) {
    onSubmit(data)
  }

  function handleRenderField(field: FieldConfig) {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <FormControl>
            <Input
              type={field.type}
              placeholder={field.placeholder}
              {...form.register(field.name)}
            />
          </FormControl>
        )

      case 'textarea':
        return (
          <FormControl>
            <Textarea
              placeholder={field.placeholder}
              className='min-h-[100px]'
              {...form.register(field.name)}
            />
          </FormControl>
        )

      case 'switch':
        return (
          <FormControl>
            <Switch
              checked={form.watch(field.name as never)}
              onCheckedChange={(value) => form.setValue(field.name as never, value)}
            />
          </FormControl>
        )

      case 'select':
        return (
          <FormControl>
            <Select
              value={form.watch(field.name as never)?.toString()}
              onValueChange={(value) => form.setValue(field.name as never, value as never)}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[500px]', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className='grid gap-4 py-4'>
              {fields.map((field) => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name as never}
                  render={({ field: fieldProps }) => (
                    <FormItem>
                      <FormLabel>
                        {field.label}
                        {field.required && <span className='text-destructive'> *</span>}
                      </FormLabel>
                      {handleRenderField(field)}
                      {field.description && (
                        <FormDescription>{field.description}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={isLoading}>
                {isLoading ? 'Saving...' : submitButtonText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default AdminDialog
