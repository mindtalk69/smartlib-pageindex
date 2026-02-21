'use client'

import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { resetRequestsApi } from '@/lib/api-client'
import { type ResetRequest } from '../data/schema'
import { useResetRequests } from '../components/reset-requests-provider'

const formSchema = z.object({
  admin_notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface DenyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resetRequest: ResetRequest | null
}

export function DenyDialog({ open, onOpenChange, resetRequest }: DenyDialogProps) {
  const { refresh } = useResetRequests()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      admin_notes: '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    if (!resetRequest) return

    setIsSubmitting(true)
    try {
      const result = await resetRequestsApi.deny(resetRequest.id, values.admin_notes)
      if (result.success) {
        toast.success('Password reset request denied')
        onOpenChange(false)
        refresh()
      } else {
        toast.error(result.error || 'Failed to deny reset request')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to deny reset request')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!resetRequest) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle>Deny Password Reset</DialogTitle>
          <DialogDescription>
            Are you sure you want to deny this password reset request for {resetRequest.username}?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='admin_notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Denial (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Explain why this request is being denied...'
                      className='min-h-[100px]'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                variant='destructive'
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Denying...' : 'Deny Request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
