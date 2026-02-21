export interface File {
  id: number
  filename: string
  file_size: number
  upload_time: string | null
  username: string
  library_name: string
  knowledge_name: string
  is_ocr: boolean
  metadata_summary: string
}
