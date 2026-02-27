'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { fetchApi, apiClient } from '@/lib/api-client'
import { Upload, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface LibraryKnowledgePair {
  library_id: string
  library_name: string
  knowledge_id: string
  knowledge_name: string
}

interface FolderUploadJob {
  id: number
  created_at: string
  file_list: string
  file_types: string | null
  background_enabled: boolean
  scheduled_time: string | null
  status: string
  log: string
  task_id?: string
}

const FILE_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'pptx', label: 'PPTX' },
  { value: 'md', label: 'Markdown' },
  { value: 'adoc', label: 'AsciiDoc' },
  { value: 'html', label: 'HTML' },
  { value: 'csv', label: 'CSV' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'bmp', label: 'BMP' },
]

export function FolderUpload() {
  const [libraryKnowledgePairs, setLibraryKnowledgePairs] = useState<LibraryKnowledgePair[]>([])
  const [selectedLibrary, setSelectedLibrary] = useState<string>('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileTypes, setFileTypes] = useState<string[]>(
    FILE_TYPES.map(t => t.value)
  )
  const [backgroundEnabled, setBackgroundEnabled] = useState(true)
  const [scheduledTime, setScheduledTime] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [jobs, setJobs] = useState<FolderUploadJob[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [selectedJob, setSelectedJob] = useState<FolderUploadJob | null>(null)
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)

  // Fetch library-knowledge pairs and jobs on mount
  useEffect(() => {
    fetchLibraryKnowledgePairs()
    fetchJobs()
  }, [])

  const fetchLibraryKnowledgePairs = async () => {
    try {
      const response = await fetchApi<any>('/admin/libraries')
      if (response.success && response.data) {
        const pairs: LibraryKnowledgePair[] = []
        response.data.forEach((lib: any) => {
          if (lib.knowledges) {
            lib.knowledges.forEach((k: any) => {
              pairs.push({
                library_id: lib.library_id,
                library_name: lib.name,
                knowledge_id: k.id,
                knowledge_name: k.name,
              })
            })
          } else {
            pairs.push({
              library_id: lib.library_id,
              library_name: lib.name,
              knowledge_id: '',
              knowledge_name: 'No Knowledge',
            })
          }
        })
        setLibraryKnowledgePairs(pairs)
      }
    } catch (error) {
      console.error('Error fetching libraries:', error)
      toast.error('Failed to load libraries')
    }
  }

  const fetchJobs = async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetchApi<FolderUploadJob[]>('/admin/folder_upload/jobs')
      if (response.success && response.data) {
        setJobs(response.data)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setIsLoadingJobs(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
    }
  }

  const handleFileTypeToggle = (value: string) => {
    setFileTypes(prev =>
      prev.includes(value)
        ? prev.filter(t => t !== value)
        : [...prev, value]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file or folder')
      return
    }

    if (!selectedLibrary) {
      toast.error('Please select a library')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('library_id', selectedLibrary)
      formData.append('file_types', fileTypes.join(','))
      formData.append('background_enabled', backgroundEnabled.toString())
      if (scheduledTime && backgroundEnabled) {
        formData.append('scheduled_time', scheduledTime)
      }

      // Append all files
      selectedFiles.forEach(file => {
        formData.append('folder_files', file)
      })

      const response = await apiClient.post('/admin/folder_upload/upload', formData)
      const data = response.data

      if (data.job_id) {
        toast.success(`Upload job created: ${data.status}`)
        fetchJobs()
        // Reset form
        setSelectedFiles([])
        const fileInput = document.getElementById('folder-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancelJob = async (jobId: number) => {
    if (!confirm('Are you sure you want to cancel this job?')) return

    try {
      const response = await fetchApi<any>(`/admin/folder_upload/job/${jobId}/cancel`, {
        method: 'POST',
      })
      if (!response.success) {
        throw new Error(response.error || 'Failed to cancel job')
      }
      toast.success('Job cancellation requested')
      fetchJobs()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel job')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'success':
      case 'completed':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>
      case 'running':
      case 'processing':
        return <Badge variant="default" className="bg-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{status}</Badge>
      case 'pending':
      case 'scheduled':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{status}</Badge>
      case 'failed':
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>
      case 'revoked':
      case 'cancelled':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getFileCount = (fileList: string) => {
    try {
      const files = JSON.parse(fileList)
      return Array.isArray(files) ? files.length : 0
    } catch {
      return 0
    }
  }

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Folder Upload</CardTitle>
            <CardDescription>Upload entire folders or multiple files for batch processing</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Library Selection */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="library-select">Select Library</Label>
                  <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Select Library --" />
                    </SelectTrigger>
                    <SelectContent>
                      {libraryKnowledgePairs.map((pair) => (
                        <SelectItem
                          key={`${pair.library_id}-${pair.knowledge_id}`}
                          value={pair.library_id}
                        >
                          {pair.library_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="folder-input">Select Folder or Files</Label>
                  <Input
                    id="folder-input"
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFileChange}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {selectedFiles.length} files selected
                  </p>
                </div>
              </div>

              {/* File Types */}
              <div className="space-y-2">
                <Label>File Types to Include</Label>
                <div className="flex flex-wrap gap-4">
                  {FILE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={fileTypes.includes(type.value)}
                        onCheckedChange={() => handleFileTypeToggle(type.value)}
                      />
                      <Label htmlFor={`type-${type.value}`} className="text-sm">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Processing Options */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="background-enabled"
                    checked={backgroundEnabled}
                    onCheckedChange={(checked) => setBackgroundEnabled(checked as boolean)}
                  />
                  <Label htmlFor="background-enabled">Enable Background Processing</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled-time">Schedule Processing Time</Label>
                  <Input
                    id="scheduled-time"
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    disabled={!backgroundEnabled}
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave blank to process immediately
                  </p>
                </div>
              </div>

              <Button type="submit" disabled={isUploading || selectedFiles.length === 0}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Schedule
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Jobs Status */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Jobs Status</CardTitle>
            <CardDescription>Track the status of your upload jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingJobs ? (
              <div className="text-center text-muted-foreground p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2">Loading jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                No upload jobs found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm">#{job.id}</TableCell>
                      <TableCell>
                        {new Date(job.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getFileCount(job.file_list)}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        {job.scheduled_time ? (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(job.scheduled_time).toLocaleString()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Immediate</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedJob(job)
                              setIsLogDialogOpen(true)
                            }}
                          >
                            View Log
                          </Button>
                          {job.status !== 'completed' && job.status !== 'failed' && job.status !== 'revoked' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelJob(job.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Main>

      {/* Log Dialog */}
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job #{selectedJob?.id} Log</DialogTitle>
            <DialogDescription>Processing log for upload job</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto bg-muted p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
            {selectedJob?.log || 'No log available'}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
