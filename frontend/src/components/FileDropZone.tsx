import { useState } from 'react';
import { cn } from '@/utils/cn';

interface FileDropZoneProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
    children: React.ReactNode;
}

export function FileDropZone({ onFilesSelected, disabled, children }: FileDropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFilesSelected(files);
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                'relative transition-colors',
                isDragging && 'bg-primary/5 ring-2 ring-primary ring-offset-2 rounded-lg'
            )}
        >
            {children}
            {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-primary z-50">
                    <div className="text-center">
                        <p className="text-sm font-medium text-primary">📎 Drop files here</p>
                        <p className="text-xs text-muted-foreground mt-1">Max 5 files, 10MB each</p>
                    </div>
                </div>
            )}
        </div>
    );
}
