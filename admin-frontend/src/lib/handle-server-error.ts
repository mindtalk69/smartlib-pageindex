import { AxiosError } from 'axios'
import { toast } from 'sonner'

export function handleServerError(error: unknown) {
    if (error instanceof AxiosError) {
        const message =
            error.response?.data?.detail ||
            error.response?.data?.message ||
            error.message ||
            'An error occurred'
        toast.error(message)
    } else if (error instanceof Error) {
        toast.error(error.message)
    } else {
        toast.error('An unexpected error occurred')
    }
}
