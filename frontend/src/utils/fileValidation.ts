// File validation utilities for SmartLib
// Handles file size, type, and count validation for attachments

export const FILE_CONSTRAINTS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 5,
    SUPPORTED_IMAGES: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
    SUPPORTED_DATA: ['.csv', '.tsv', '.xlsx'],
};

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateFileSize(file: File): ValidationResult {
    if (file.size > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size: 10MB`,
        };
    }
    return { valid: true };
}

export function validateFileType(file: File): ValidationResult {
    const isImage = FILE_CONSTRAINTS.SUPPORTED_IMAGES.includes(file.type);
    const isData = FILE_CONSTRAINTS.SUPPORTED_DATA.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isImage && !isData) {
        return {
            valid: false,
            error: `Unsupported file type: ${file.name}. Supported: Images (PNG, JPG, GIF, WebP), Data (CSV, TSV, XLSX)`,
        };
    }

    // Reject old Excel format
    if (file.name.toLowerCase().endsWith('.xls')) {
        return {
            valid: false,
            error: 'Old Excel format (.xls) not supported. Please convert to .xlsx or save as CSV',
        };
    }

    return { valid: true };
}

export function validateTotalFiles(currentCount: number, newCount: number): ValidationResult {
    if (currentCount + newCount > FILE_CONSTRAINTS.MAX_FILES) {
        return {
            valid: false,
            error: `Maximum ${FILE_CONSTRAINTS.MAX_FILES} files allowed. Currently: ${currentCount}`,
        };
    }
    return { valid: true };
}

export function getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.name.endsWith('.csv')) return '📄';
    if (file.name.endsWith('.tsv')) return '📄';
    if (file.name.endsWith('.xlsx')) return '📊';
    return '📎';
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isImageFile(file: File): boolean {
    return FILE_CONSTRAINTS.SUPPORTED_IMAGES.includes(file.type);
}

export function isDataFile(file: File): boolean {
    return FILE_CONSTRAINTS.SUPPORTED_DATA.some(ext => file.name.toLowerCase().endsWith(ext));
}

export function getDataFileType(file: File): 'csv' | 'tsv' | 'excel_base64' | null {
    if (file.name.toLowerCase().endsWith('.csv')) return 'csv';
    if (file.name.toLowerCase().endsWith('.tsv')) return 'tsv';
    if (file.name.toLowerCase().endsWith('.xlsx')) return 'excel_base64';
    return null;
}
