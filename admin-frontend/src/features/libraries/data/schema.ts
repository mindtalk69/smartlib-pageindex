export interface Library {
  id: string
  library_id: string
  name: string
  description: string
  knowledge_names: string[]
  knowledge_ids: string[]
  created_by_username: string
  created_at: string | null
}
