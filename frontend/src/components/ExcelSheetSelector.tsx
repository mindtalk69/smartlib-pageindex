import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExcelSheetSelectorProps {
    file: File;
    onSheetsSelected: (sheetNames: string[]) => void;
    initialSelection?: string[];
}

export function ExcelSheetSelector({ file, onSheetsSelected, initialSelection = [] }: ExcelSheetSelectorProps) {
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheets, setSelectedSheets] = useState<string[]>(initialSelection);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const readSheetNames = async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array', bookSheets: true });
                const names = workbook.SheetNames;
                setSheetNames(names);

                // Auto-select first sheet if no initial selection
                if (initialSelection.length === 0 && names.length > 0) {
                    setSelectedSheets([names[0]]);
                    onSheetsSelected([names[0]]);
                }
            } catch (error) {
                console.error('Error reading Excel sheets:', error);
            } finally {
                setLoading(false);
            }
        };

        readSheetNames();
    }, [file]);

    const handleToggleSheet = (sheetName: string) => {
        const newSelection = selectedSheets.includes(sheetName)
            ? selectedSheets.filter(s => s !== sheetName)
            : selectedSheets.length < 3
                ? [...selectedSheets, sheetName]
                : selectedSheets; // Max 3 sheets

        setSelectedSheets(newSelection);
        onSheetsSelected(newSelection);
    };

    if (loading) {
        return <div className="text-xs text-muted-foreground">Reading sheets...</div>;
    }

    if (sheetNames.length === 0) {
        return <div className="text-xs text-destructive">No sheets found</div>;
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs">Select sheets (max 3):</Label>
                <span className="text-xs text-muted-foreground">{selectedSheets.length}/3</span>
            </div>
            <ScrollArea className="h-24 rounded border bg-muted/30 p-2">
                <div className="space-y-1.5">
                    {sheetNames.map((sheetName) => (
                        <div key={sheetName} className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id={`sheet-${sheetName}`}
                                checked={selectedSheets.includes(sheetName)}
                                onChange={() => handleToggleSheet(sheetName)}
                                disabled={!selectedSheets.includes(sheetName) && selectedSheets.length >= 3}
                                className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                            />
                            <Label
                                htmlFor={`sheet-${sheetName}`}
                                className="text-xs font-normal cursor-pointer flex-1 truncate"
                            >
                                {sheetName}
                            </Label>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
