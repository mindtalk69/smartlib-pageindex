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
import { Textarea } from '@/components/ui/textarea'
import { AiDescriptionButton } from '@/components/ai-description-button'
import { useCatalogs } from './catalogs-provider'
import { type Catalog } from '../data/schema'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
})

type CatalogForm = z.infer<typeof formSchema>

type CatalogsActionDialogProps = {
  currentRow?: Catalog
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CatalogsActionDialog({
  currentRow,
  open,
  onOpenChange,
}: CatalogsActionDialogProps) {
  const isEdit = !!currentRow
  const { refresh, updateCatalog, createCatalog } = useCatalogs()

  const form = useForm<CatalogForm>({
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
        item_type: 'catalog',
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

  const onSubmit = async (values: CatalogForm) => {
    if (isEdit && currentRow) {
      const success = await updateCatalog(currentRow.id, values)
      if (success) {
        toast.success(`Catalog "${values.name}" has been updated`)
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to update catalog')
      }
    } else {
      const id = await createCatalog(values)
      if (id) {
        toast.success('Catalog created successfully')
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to create catalog')
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
            {isEdit ? 'Edit Catalog' : 'Add New Catalog'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the catalog details here. '
              : 'Create a new catalog. '}
            Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='catalog-form'
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
                    <Input placeholder='e.g., Research Catalog' {...field} />
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
                      placeholder='Describe the purpose of this catalog...'
                      className='min-h-[80px]'
                      {...field}
                    />
                  </FormControl>
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
          <Button type='submit' form='catalog-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
