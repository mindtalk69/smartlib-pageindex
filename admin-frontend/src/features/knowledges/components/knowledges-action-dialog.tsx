'use client'

import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { AiDescriptionButton } from '@/components/ai-description-button'
import { useKnowledges } from './knowledges-provider'
import { type Knowledge } from '../data/schema'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
  category_ids: z.array(z.string()).optional(),
  catalog_ids: z.array(z.string()).optional(),
  library_ids: z.array(z.string()).optional(),
  group_ids: z.array(z.string()).optional(),
})

type KnowledgeForm = z.infer<typeof formSchema>

type KnowledgesActionDialogProps = {
  currentRow?: Knowledge
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KnowledgesActionDialog({
  currentRow,
  open,
  onOpenChange,
}: KnowledgesActionDialogProps) {
  const isEdit = !!currentRow
  const { refresh, updateKnowledge, createKnowledge, categories, catalogs, libraries, groups, refreshRelatedData } = useKnowledges()
  const [categoryFilter, setCategoryFilter] = useState('')
  const [catalogFilter, setCatalogFilter] = useState('')
  const [libraryFilter, setLibraryFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')

  const form = useForm<KnowledgeForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: currentRow?.name || '',
      description: currentRow?.description || '',
      category_ids: currentRow?.category_names ? [] : [],
      catalog_ids: currentRow?.catalog_names ? [] : [],
      library_ids: currentRow?.library_names ? [] : [],
      group_ids: currentRow?.group_names ? [] : [],
    },
  })

  // Reset filters when dialog opens
  useEffect(() => {
    if (open) {
      setCategoryFilter('')
      setCatalogFilter('')
      setLibraryFilter('')
      setGroupFilter('')
      refreshRelatedData()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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
        item_type: 'knowledge',
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

  const onSubmit = async (values: KnowledgeForm) => {
    if (isEdit && currentRow) {
      const success = await updateKnowledge(currentRow.id, values)
      if (success) {
        toast.success(`Knowledge "${values.name}" has been updated`)
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to update knowledge')
      }
    } else {
      const id = await createKnowledge(values)
      if (id) {
        toast.success('Knowledge created successfully')
        form.reset()
        onOpenChange(false)
        await refresh()
      } else {
        toast.error('Failed to create knowledge')
      }
    }
  }

  // Filter functions
  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categoryFilter.toLowerCase())
  )
  const filteredCatalogs = catalogs.filter(c =>
    c.name.toLowerCase().includes(catalogFilter.toLowerCase())
  )
  const filteredLibraries = libraries.filter(l =>
    l.name.toLowerCase().includes(libraryFilter.toLowerCase())
  )
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupFilter.toLowerCase())
  )

  // Get selected counts
  const selectedCategoryIds = form.watch('category_ids') || []
  const selectedCatalogIds = form.watch('catalog_ids') || []
  const selectedLibraryIds = form.watch('library_ids') || []
  const selectedGroupIds = form.watch('group_ids') || []

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit Knowledge' : 'Add New Knowledge'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the knowledge details here. '
              : 'Create a new knowledge base. '}
            Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='knowledge-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <Tabs defaultValue='basic' className='w-full'>
              <TabsList className='grid w-full grid-cols-5'>
                <TabsTrigger value='basic'>Basic</TabsTrigger>
                <TabsTrigger value='categories'>Categories</TabsTrigger>
                <TabsTrigger value='catalogs'>Catalogs</TabsTrigger>
                <TabsTrigger value='libraries'>Libraries</TabsTrigger>
                <TabsTrigger value='groups'>Groups</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value='basic' className='space-y-4 mt-4'>
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
                          placeholder='Describe the purpose of this knowledge base...'
                          className='min-h-[100px]'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Categories Tab */}
              <TabsContent value='categories' className='mt-4'>
                <div className='space-y-3'>
                  <div className='text-sm text-muted-foreground'>
                    Selected: {selectedCategoryIds.length} category(s)
                  </div>
                  <div className='input-group relative'>
                    <Input
                      placeholder='Filter categories...'
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className='pl-9'
                    />
                    <svg className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                    </svg>
                  </div>
                  <div className='border rounded-md p-3 max-h-[300px] overflow-y-auto'>
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((category) => (
                        <div key={category.id} className='flex items-center space-x-2 py-2 border-b last:border-0'>
                          <Checkbox
                            id={`category_${category.id}`}
                            value={category.id}
                            checked={selectedCategoryIds.includes(category.id)}
                            onCheckedChange={(checked) => {
                              const current = form.getValues('category_ids') || []
                              if (checked) {
                                form.setValue('category_ids', [...current, category.id])
                              } else {
                                form.setValue('category_ids', current.filter(id => id !== category.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={`category_${category.id}`}
                            className='text-sm font-medium leading-none cursor-pointer flex-1'
                          >
                            {category.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className='text-sm text-muted-foreground text-center py-4'>No categories available</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Catalogs Tab */}
              <TabsContent value='catalogs' className='mt-4'>
                <div className='space-y-3'>
                  <div className='text-sm text-muted-foreground'>
                    Selected: {selectedCatalogIds.length} catalog(s)
                  </div>
                  <div className='input-group relative'>
                    <Input
                      placeholder='Filter catalogs...'
                      value={catalogFilter}
                      onChange={(e) => setCatalogFilter(e.target.value)}
                      className='pl-9'
                    />
                    <svg className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                    </svg>
                  </div>
                  <div className='border rounded-md p-3 max-h-[300px] overflow-y-auto'>
                    {filteredCatalogs.length > 0 ? (
                      filteredCatalogs.map((catalog) => (
                        <div key={catalog.id} className='flex items-center space-x-2 py-2 border-b last:border-0'>
                          <Checkbox
                            id={`catalog_${catalog.id}`}
                            value={catalog.id}
                            checked={selectedCatalogIds.includes(catalog.id)}
                            onCheckedChange={(checked) => {
                              const current = form.getValues('catalog_ids') || []
                              if (checked) {
                                form.setValue('catalog_ids', [...current, catalog.id])
                              } else {
                                form.setValue('catalog_ids', current.filter(id => id !== catalog.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={`catalog_${catalog.id}`}
                            className='text-sm font-medium leading-none cursor-pointer flex-1'
                          >
                            {catalog.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className='text-sm text-muted-foreground text-center py-4'>No catalogs available</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Libraries Tab */}
              <TabsContent value='libraries' className='mt-4'>
                <div className='space-y-3'>
                  <div className='text-sm text-muted-foreground'>
                    Selected: {selectedLibraryIds.length} library(s)
                  </div>
                  <div className='input-group relative'>
                    <Input
                      placeholder='Filter libraries...'
                      value={libraryFilter}
                      onChange={(e) => setLibraryFilter(e.target.value)}
                      className='pl-9'
                    />
                    <svg className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                    </svg>
                  </div>
                  <div className='border rounded-md p-3 max-h-[300px] overflow-y-auto'>
                    {filteredLibraries.length > 0 ? (
                      filteredLibraries.map((library) => (
                        <div key={library.id} className='flex items-center space-x-2 py-2 border-b last:border-0'>
                          <Checkbox
                            id={`library_${library.id}`}
                            value={library.id}
                            checked={selectedLibraryIds.includes(library.id)}
                            onCheckedChange={(checked) => {
                              const current = form.getValues('library_ids') || []
                              if (checked) {
                                form.setValue('library_ids', [...current, library.id])
                              } else {
                                form.setValue('library_ids', current.filter(id => id !== library.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={`library_${library.id}`}
                            className='text-sm font-medium leading-none cursor-pointer flex-1'
                          >
                            {library.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className='text-sm text-muted-foreground text-center py-4'>No libraries available</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Groups Tab */}
              <TabsContent value='groups' className='mt-4'>
                <div className='space-y-3'>
                  <div className='text-sm text-muted-foreground'>
                    Selected: {selectedGroupIds.length} group(s)
                  </div>
                  <div className='input-group relative'>
                    <Input
                      placeholder='Filter groups...'
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      className='pl-9'
                    />
                    <svg className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                    </svg>
                  </div>
                  <div className='border rounded-md p-3 max-h-[300px] overflow-y-auto'>
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => (
                        <div key={group.id} className='flex items-center space-x-2 py-2 border-b last:border-0'>
                          <Checkbox
                            id={`group_${group.id}`}
                            value={group.id}
                            checked={selectedGroupIds.includes(group.id)}
                            onCheckedChange={(checked) => {
                              const current = form.getValues('group_ids') || []
                              if (checked) {
                                form.setValue('group_ids', [...current, group.id])
                              } else {
                                form.setValue('group_ids', current.filter(id => id !== group.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={`group_${group.id}`}
                            className='text-sm font-medium leading-none cursor-pointer flex-1'
                          >
                            {group.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className='text-sm text-muted-foreground text-center py-4'>No groups available</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='submit' form='knowledge-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
