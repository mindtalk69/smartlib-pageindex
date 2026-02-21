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

interface ApproveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resetRequest: ResetRequest | null
}

export function ApproveDialog({ open, onOpenChange, resetRequest }: ApproveDialogProps) {
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
      const result = await resetRequestsApi.approve(resetRequest.id, values.admin_notes)
      if (result.success) {
        toast.success(
          `Password reset approved for ${resetRequest.username}. ${result.message || 'Temporary password has been generated.'}`
        )
        onOpenChange(false)
        refresh()
      } else {
        toast.error(result.error || 'Failed to approve reset request')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve reset request')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!resetRequest) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle>Approve Password Reset</DialogTitle>
          <DialogDescription>
            This will generate a temporary password for {resetRequest.username}.
            The temporary password should be provided securely to the user.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='admin_notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Add any notes about this approval...'
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
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? 'Approving...' : 'Approve & Generate Password'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
