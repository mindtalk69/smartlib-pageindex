'use client'

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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useProviders } from './providers-provider'
import { type Provider } from '@/lib/api-client'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  provider_type: z.string().min(1, 'Provider type is required.'),
  base_url: z.string().optional(),
  api_key: z.string().optional(),
  is_active: z.boolean().default(true),
  priority: z.coerce.number().default(0),
})

type ProviderForm = z.infer<typeof formSchema>

type ProvidersActionDialogProps = {
  currentRow?: Provider
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProvidersActionDialog({
  currentRow,
  open,
  onOpenChange,
}: ProvidersActionDialogProps) {
  const isEdit = !!currentRow
  const { refresh, updateProvider } = useProviders()

  const form = useForm<ProviderForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          name: currentRow.name,
          provider_type: currentRow.provider_type,
          base_url: currentRow.base_url || '',
          api_key: currentRow.api_key || '',
          is_active: currentRow.is_active,
          priority: currentRow.priority || 0,
        }
      : {
          name: '',
          provider_type: '',
          base_url: '',
          api_key: '',
          is_active: true,
          priority: 0,
        },
  })

  const onSubmit = async (values: ProviderForm) => {
    if (isEdit && currentRow) {
      const success = await updateProvider(currentRow.id, values)
      if (success) {
        toast.success(`Provider "${values.name}" has been updated`)
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to update provider')
      }
    } else {
      // TODO: Implement create provider
      toast.info('Create provider - coming soon')
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit Provider' : 'Add New Provider'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the provider details here. '
              : 'Create a new LLM provider. '}
            Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='provider-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., My OpenAI Provider' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='provider_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., openai, anthropic, azure'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='base_url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., https://api.openai.com/v1' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='api_key'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder='sk-...'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='is_active'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='m-0'>Active</FormLabel>
                    <FormDescription>
                      Enable this provider to make it available for use
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='priority'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <Input type='number' {...field} />
                  </FormControl>
                  <FormDescription>
                    Lower numbers have higher priority
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='submit' form='provider-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
