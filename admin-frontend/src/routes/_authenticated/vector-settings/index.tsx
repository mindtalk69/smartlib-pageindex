import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { ThemeSwitch } from '@/components/theme-switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Save, RotateCcw, Users, Globe, BookOpen, AlertTriangle } from 'lucide-react'

interface VectorSettings {
  success: boolean
  sqlite_table_name: string
  vector_store_mode: string
}

export const Route = createFileRoute('/_authenticated/vector-settings/')({
  component: VectorSettingsPage,
})

function VectorSettingsPage() {
  const [settings, setSettings] = useState<VectorSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [sqliteTableName, setSqliteTableName] = useState<string>('document_vectors')
  const [vectorStoreMode, setVectorStoreMode] = useState<string>('user')

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchApi<any>('/admin/vector-settings')
      if (response.success && response.data) {
        setSettings(response.data)
        setSqliteTableName(response.data.sqlite_table_name)
        setVectorStoreMode(response.data.vector_store_mode)
      } else {
        setError('Failed to fetch settings')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetchApi<any>('/admin/vector-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sqlite_table_name: sqliteTableName,
          vector_store_mode: vectorStoreMode,
        }),
      })
      if (response.success && response.data) {
        setSuccess('Settings saved successfully!')
        fetchSettings()
      } else {
        setError(response.error || 'Failed to save settings')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const resetVectorStore = async () => {
    if (resetConfirmText !== 'RESET VECTORS') {
      setError("Type 'RESET VECTORS' to confirm")
      return
    }

    setResetting(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetchApi<any>('/admin/vector-settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_text: resetConfirmText }),
      })
      if (response.success && response.data) {
        const msg = (response.data as any).message || 'Vector store reset successfully!'
        setSuccess(msg)
        setShowResetConfirm(false)
        setResetConfirmText('')
      } else {
        setError(response.error || 'Failed to reset vector store')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset vector store')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vector Settings</h1>
          <p className="text-muted-foreground">
            Configure SQLite-VEC vector store settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitch />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="dark:bg-red-950/20 dark:border-red-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="dark:bg-green-950/20 dark:border-green-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SQLite Settings */}
        <Card>
          <CardHeader>
            <CardTitle>SQLite-VEC Settings</CardTitle>
            <CardDescription>
              Configuration for SQLite vector store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sqlite-table">Table Name</Label>
              <Input
                id="sqlite-table"
                value={sqliteTableName}
                onChange={(e) => setSqliteTableName(e.target.value)}
                placeholder="document_vectors"
              />
              <p className="text-xs text-muted-foreground">
                The SQLite table used for storing vector embeddings
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Vector Store Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Vector Store Mode
            </CardTitle>
            <CardDescription>
              Define how vectors are organized and accessed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={vectorStoreMode}
              onValueChange={setVectorStoreMode}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="user" id="user-mode" />
                <Label htmlFor="user-mode" className="cursor-pointer flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  User
                  <span className="text-muted-foreground text-sm ml-2">
                    - Each user has their own private vector space
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="global-mode" />
                <Label htmlFor="global-mode" className="cursor-pointer flex items-center">
                  <Globe className="mr-2 h-4 w-4" />
                  Global
                  <span className="text-muted-foreground text-sm ml-2">
                    - All users share one vector space
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="knowledge" id="knowledge-mode" />
                <Label htmlFor="knowledge-mode" className="cursor-pointer flex items-center">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Knowledge
                  <span className="text-muted-foreground text-sm ml-2">
                    - Vectors organized by knowledge base
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
          <Button variant="outline" onClick={fetchSettings}>
            Reset Form
          </Button>
        </div>

        {/* Reset Vector Store */}
        <div>
          {!showResetConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowResetConfirm(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Vector Store
            </Button>
          ) : (
            <Card className="p-4 border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Warning: This will delete all vectors!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Type <code className="bg-muted px-1 rounded">RESET VECTORS</code> to confirm
                </p>
                <Input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET VECTORS"
                  className="border-red-300 dark:border-red-700"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={resetVectorStore}
                    disabled={resetting || resetConfirmText !== 'RESET VECTORS'}
                  >
                    {resetting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Confirm Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowResetConfirm(false)
                      setResetConfirmText('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
