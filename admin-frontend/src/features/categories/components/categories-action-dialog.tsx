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
import { useCategories } from './categories-provider'
import { type Category } from '../data/schema'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
})

type CategoryForm = z.infer<typeof formSchema>

type CategoriesActionDialogProps = {
  currentRow?: Category
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoriesActionDialog({
  currentRow,
  open,
  onOpenChange,
}: CategoriesActionDialogProps) {
  const isEdit = !!currentRow
  const { refresh, updateCategory, createCategory } = useCategories()

  const form = useForm<CategoryForm>({
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

  const onSubmit = async (values: CategoryForm) => {
    if (isEdit && currentRow) {
      const success = await updateCategory(currentRow.id, values)
      if (success) {
        toast.success(`Category "${values.name}" has been updated`)
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to update category')
      }
    } else {
      const id = await createCategory(values)
      if (id) {
        toast.success('Category created successfully')
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to create category')
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
            {isEdit ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the category details here. '
              : 'Create a new category. '}
            Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='category-form'
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
                    <Input placeholder='e.g., Research Category' {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Describe the purpose of this category...'
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
          <Button type='submit' form='category-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
