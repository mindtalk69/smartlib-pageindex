import { Loader2 } from "lucide-react";

// Get contextual icon based on status message
function getProgressIcon(status: string): string {
    const lowerStatus = status.toLowerCase();

    if (lowerStatus.includes('search') || lowerStatus.includes('mencari')) {
        return '🔍';
    } else if (lowerStatus.includes('found') || lowerStatus.includes('ditemukan')) {
        return '📄';
    } else if (lowerStatus.includes('generat') || lowerStatus.includes('menyusun')) {
        return '✍️';
    } else if (lowerStatus.includes('analyz') || lowerStatus.includes('menganalisis')) {
        return '📊';
    } else if (lowerStatus.includes('routing') || lowerStatus.includes('mengarahkan')) {
        return '🧭';
    } else if (lowerStatus.includes('process')) {
        return '⚙️';
    }

    return '🔄';
}

export function ThinkingAnimation({ status }: { status?: string | null }) {
    const icon = status ? getProgressIcon(status) : '🔄';

    return (
        <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {status && (
                <span className="text-sm animate-pulse">
                    <span className="mr-1.5">{icon}</span>
                    {status}
                </span>
            )}
        </div>
    );
}
