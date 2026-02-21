import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Mail, Lock, UserPlus, Loader2, CheckCircle2 } from 'lucide-react'

/**
 * RegisterPage Component
 * 
 * Registration form with username, email, password, and confirm password fields.
 * Uses shadcn/ui Card, Button, Input components to match LoginPage design.
 */
export function RegisterPage() {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)

        // Client-side validation
        if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
            setError('All fields are required')
            return
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters')
            return
        }

        if (username.length > 20) {
            setError('Username cannot exceed 20 characters')
            return
        }

        if (!email.includes('@') || !email.includes('.')) {
            setError('Please enter a valid email address')
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (!/[A-Z]/.test(password)) {
            setError('Password must contain at least one uppercase letter')
            return
        }

        if (!/\d/.test(password)) {
            setError('Password must contain at least one number')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setIsLoading(true)

        try {
            console.log('[Register] Submitting to /api/register:', { username, email })

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    confirm_password: confirmPassword,
                }),
            })

            const data = await response.json()
            console.log('[Register] API response:', data)

            if (data.success) {
                // Success - navigate to login
                console.log('[Register] Registration successful')
                navigate('/login', {
                    state: { message: data.message || 'Registration successful! Please login.' }
                })
            } else {
                // Error - display message from API
                console.log('[Register] Registration failed:', data.error)
                setError(data.error || 'Registration failed. Please try again.')
            }
        } catch (err) {
            console.error('[Register] Network error:', err)
            setError('Network error. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
                    <CardDescription>
                        Sign up to get started with SmartLib
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Username (3-20 characters)"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Password (8+ chars, 1 uppercase, 1 number)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="relative">
                            <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Sign up
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="text-center text-sm">
                        <p className="text-muted-foreground">
                            Already have an account?{' '}
                            <Link to="/login" className="font-semibold text-primary hover:underline">
                                Log in
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
