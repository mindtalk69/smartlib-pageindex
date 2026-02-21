import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { User, Lock, LogIn, Loader2 } from 'lucide-react'

/**
 * LoginPage Component
 * 
 * Login form with username/password and Entra ID options.
 * Uses shadcn/ui Card, Button, Input components.
 */
export function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!username.trim() || !password.trim()) {
            setError('Please enter username and password')
            return
        }

        setIsLoading(true)
        setError(null)

        const result = await login(username, password)

        if (result.success) {
            navigate('/')
        } else {
            setError(result.error || 'Login failed')
        }

        setIsLoading(false)
    }

    const handleEntraLogin = () => {
        // Redirect to Azure AD login via Flask
        window.location.href = '/login_azure'
    }

    const handleGoogleLogin = () => {
        // Redirect to Google OAuth login via Flask
        window.location.href = '/login_google'
    }

    const handleOktaLogin = () => {
        // Redirect to Okta OAuth login via Flask
        window.location.href = '/login_okta'
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Login</CardTitle>
                    <CardDescription>
                        Please enter your credentials to login.
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
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="pl-10"
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-4 w-4" />
                                    Log in
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        size="lg"
                        onClick={handleEntraLogin}
                    >
                        <svg
                            className="mr-2 h-4 w-4"
                            viewBox="0 0 23 23"
                            fill="none"
                        >
                            <path d="M11 0H0V11H11V0Z" fill="#F25022" />
                            <path d="M23 0H12V11H23V0Z" fill="#7FBA00" />
                            <path d="M11 12H0V23H11V12Z" fill="#00A4EF" />
                            <path d="M23 12H12V23H23V12Z" fill="#FFB900" />
                        </svg>
                        Log in with Entra ID
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        size="lg"
                        onClick={handleGoogleLogin}
                    >
                        <svg
                            className="mr-2 h-4 w-4"
                            viewBox="0 0 24 24"
                        >
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Log in with Google
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        size="lg"
                        onClick={handleOktaLogin}
                    >
                        <svg
                            className="mr-2 h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fill="#0073CE"
                                d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3zm0 6c2.761 0 5 2.239 5 5s-2.239 5-5 5-5-2.239-5-5 2.239-5 5-5zm0 8c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"
                            />
                        </svg>
                        Log in with Okta
                    </Button>

                    <div className="text-center text-sm space-y-2">
                        <p className="text-muted-foreground">
                            Don't have an account?{' '}
                            <Link to="/register" className="font-semibold text-primary hover:underline">
                                Sign up
                            </Link>
                        </p>
                        <p>
                            <a href="/request_password_reset" className="font-semibold text-primary hover:underline">
                                Forgot password?
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
