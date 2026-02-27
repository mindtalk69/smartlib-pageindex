import { useState, FormEvent } from 'react'
import { api } from '@/utils/apiClient'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Shield, ShieldCheck, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'

/**
 * ChangePasswordPage Component
 * 
 * Change password form with current/new/confirm password fields.
 * Uses shadcn/ui Card, Button, Input components.
 * Matches LoginPage design pattern.
 */
export function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()

    // Password strength indicators
    const hasMinLength = newPassword.length >= 8
    const hasUppercase = /[A-Z]/.test(newPassword)
    const hasNumber = /\d/.test(newPassword)
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            setError('Please fill in all password fields')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match')
            return
        }

        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const data = await api.post<any>('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
                confirm_new_password: confirmPassword,
            })

            if (data.success) {
                setSuccess(data.message || 'Password changed successfully!')
                // Clear form
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
                // Redirect after short delay
                setTimeout(() => {
                    navigate('/')
                }, 2000)
            } else {
                setError(data.error || 'Failed to change password')
            }
        } catch (err) {
            console.error('Change password error:', err)
            setError('Network error. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleBack = () => {
        navigate('/')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Change Password</CardTitle>
                    <CardDescription>
                        Secure your account with a new password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm p-3 rounded-lg flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                {success}
                            </div>
                        )}

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Current Password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="New Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        {/* Password strength indicators */}
                        {newPassword.length > 0 && (
                            <div className="text-xs space-y-1 px-1">
                                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-green-600 dark:bg-green-400' : 'bg-muted-foreground/50'}`} />
                                    At least 8 characters
                                </div>
                                <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-green-600 dark:bg-green-400' : 'bg-muted-foreground/50'}`} />
                                    At least one uppercase letter
                                </div>
                                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-green-600 dark:bg-green-400' : 'bg-muted-foreground/50'}`} />
                                    At least one number
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        {/* Password match indicator */}
                        {confirmPassword.length > 0 && (
                            <div className={`text-xs flex items-center gap-1.5 px-1 ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? 'bg-green-600 dark:bg-green-400' : 'bg-destructive'}`} />
                                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={isLoading || !!success}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    Update Password
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="text-center">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleBack}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Chat
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
