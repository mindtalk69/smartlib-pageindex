import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ThemeSwitch } from '@/components/theme-switch'
import { Loader2, RefreshCw, FileText, Database, Calendar, Hash, FolderOpen } from 'lucide-react'

interface VectorReferenceLog {
  success: boolean
  log_files: string[]
  log_directory: string
}

interface LogStats {
  total_entries: number
  unique_files: number
  file_counts: Record<string, number>
  date_range: string
}

interface VectorReferenceLogView {
  success: boolean
  references: any[]
  log_filename: string
  log_stats: LogStats
  log_directory: string
}

export const Route = createFileRoute('/_authenticated/vector-references/')({
  component: VectorReferencesPage,
})

function VectorReferencesPage() {
  const [logs, setLogs] = useState<VectorReferenceLog | null>(null)
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [logContent, setLogContent] = useState<VectorReferenceLogView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    setSelectedLog(null)
    setLogContent(null)
    try {
      const response = await fetchApi<VectorReferenceLog>('/admin/vector-references')
      if (response.success && response.data) {
        setLogs(response.data)
      } else {
        setError(response.error || 'Failed to fetch logs')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  const fetchLogContent = async (logFile: string) => {
    setLoading(true)
    setError(null)
    setSelectedLog(logFile)
    try {
      const response = await fetchApi<VectorReferenceLogView>(`/admin/vector-references/${encodeURIComponent(logFile)}`)
      if (response.success && response.data) {
        setLogContent(response.data)
      } else {
        setError(response.error || 'Failed to fetch log content')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch log content')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vector References</h1>
          <p className="text-muted-foreground">
            View and manage vector store reference logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          <Button onClick={fetchLogs} disabled={loading} variant="outline">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Log Files List */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Log Files
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto divide-y dark:divide-gray-800">
                {logs?.log_files.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground">
                    No log files found
                  </div>
                )}
                {!logs && !loading && (
                  <div className="p-4 text-center text-muted-foreground">
                    Click Refresh to load logs
                  </div>
                )}
                {logs?.log_files.map((logFile) => (
                  <button
                    key={logFile}
                    onClick={() => fetchLogContent(logFile)}
                    className={`w-full p-3 text-left hover:bg-muted transition-colors dark:hover:bg-gray-800 ${
                      selectedLog === logFile ? 'bg-primary/10 dark:bg-primary/20' : ''
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{logFile}</div>
                    <div className="text-xs text-muted-foreground">
                      Click to view
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Log Content */}
        <div className="md:col-span-2">
          {!selectedLog && !logContent && (
            <Card className="h-[400px] flex items-center justify-center">
              <CardContent>
                <div className="text-center">
                  <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-3" />
                  <p className="text-muted-foreground">
                    Select a log file to view its contents
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card className="h-[400px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </Card>
          )}

          {logContent && !loading && (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{logContent.log_stats.total_entries || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Entries</div>
                      </div>
                      <Database className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{logContent.log_stats.unique_files || 0}</div>
                        <div className="text-sm text-muted-foreground">Unique Files</div>
                      </div>
                      <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Date Range</div>
                        <div className="text-sm text-muted-foreground">{logContent.log_stats.date_range || 'N/A'}</div>
                      </div>
                      <Calendar className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* File Counts */}
              {Object.keys(logContent.log_stats.file_counts || {}).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <Hash className="mr-2 h-5 w-5" />
                      Entries per File
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(logContent.log_stats.file_counts || {}).map(([fileId, count]) => (
                        <div
                          key={fileId}
                          className="px-3 py-1 bg-muted dark:bg-gray-800 rounded-full text-sm"
                          title={`File ID: ${fileId}`}
                        >
                          #{fileId}: {count}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* References Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">References</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File ID</TableHead>
                          <TableHead>Chunk ID</TableHead>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logContent.references.slice(0, 100).map((ref: any, idx: number) => (
                          <TableRow key={idx} className="hover:bg-muted/50 dark:hover:bg-gray-800/50">
                            <TableCell className="font-mono text-xs">
                              {ref.file_id || ref.fileId || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {ref.chunk_id || ref.chunkId || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {ref.timestamp || '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {ref.source_file || ref.source || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {logContent.references.length > 100 && (
                    <div className="p-3 text-center text-sm text-muted-foreground border-t dark:border-gray-800">
                      Showing first 100 of {logContent.references.length} entries
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
