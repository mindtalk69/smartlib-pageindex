'use client'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Textarea } from '@/components/ui/textarea'
import { AiDescriptionButton } from '@/components/ai-description-button'
import { useLibraries } from './libraries-provider'
import { type Library } from '../data/schema'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
})

type LibraryForm = z.infer<typeof formSchema>

type LibrariesActionDialogProps = {
  currentRow?: Library
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LibrariesActionDialog({
  currentRow,
  open,
  onOpenChange,
}: LibrariesActionDialogProps) {
  const isEdit = !!currentRow
  const { refresh, updateLibrary, createLibrary } = useLibraries()

  const form = useForm<LibraryForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          name: currentRow.name,
          description: currentRow.description || '',
        }
      : {
          name: '',
          description: '',
        },
  })

  const handleGenerateDescription = async (language: string) => {
    const nameValue = form.getValues('name')
    if (!nameValue?.trim()) {
      toast.warning('Please enter a name first to generate a description.')
      return
    }

    try {
      const { aiDescriptionApi } = await import('@/lib/api-client')
      const result = await aiDescriptionApi.generate({
        context_text: nameValue,
        item_type: 'library',
        language,
      })

      if (result.success && result.description) {
        form.setValue('description', result.description)
        toast.success('Description generated successfully')
      } else {
        toast.error(result.error || 'Failed to generate description')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate description')
    }
  }

  const onSubmit = async (values: LibraryForm) => {
    if (isEdit && currentRow) {
      const success = await updateLibrary(currentRow.id, values)
      if (success) {
        toast.success(`Library "${values.name}" has been updated`)
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to update library')
      }
    } else {
      const id = await createLibrary(values)
      if (id) {
        toast.success('Library created successfully')
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to create library')
      }
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
            {isEdit ? 'Edit Library' : 'Add New Library'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the library details here. '
              : 'Create a new library. '}
            Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='library-form'
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
                    <Input placeholder='e.g., Research Documents' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel>Description (optional)</FormLabel>
                    <AiDescriptionButton
                      onGenerate={handleGenerateDescription}
                      disabled={!form.getValues('name')}
                    />
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder='Describe the purpose of this library...'
                      className='min-h-[80px]'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Alert>
              <AlertDescription className='text-sm'>
                <strong>Assigning Knowledges to Libraries</strong>
                <p className='mt-1'>
                  Libraries can be assigned to knowledges from the{' '}
                  <a href='/knowledges' className='font-medium underline underline-offset-4'>
                    Knowledge Management
                  </a>{' '}
                  page. This provides better control over knowledge-library relationships.
                </p>
              </AlertDescription>
            </Alert>
          </form>
        </Form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='submit' form='library-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
