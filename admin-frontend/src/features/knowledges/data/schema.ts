export interface Knowledge {
  id: number
  name: string
  description: string
  category_names: string[]
  catalog_names: string[]
  library_names: string[]
  group_names: string[]
  created_by_username: string
  created_at: string | null
}
