
import { ActiveContent } from "../App";
import { VisualEvidenceContent } from "./VisualEvidence";
import { Map as MapIcon, Image as ImageIcon, BarChart3 as ChartIcon, Table as TableIcon } from "lucide-react";

interface LiveDisplayProps {
    activeContent: ActiveContent | null;
    imageBase64: string | null;
    imageMimeType: string | null;
}

export function LiveDisplay({ activeContent, imageBase64, imageMimeType }: LiveDisplayProps) {
    if (!activeContent) {
        return (
            <div className="flex-1 h-full flex items-center justify-center bg-muted/20">
                <div className="text-center text-muted-foreground p-8 max-w-md">
                    <h2 className="text-2xl font-semibold mb-2">Live Display</h2>
                    <p className="mb-4">Interact with the agent to see visual results here.</p>
                    <div className="grid grid-cols-2 gap-4 text-sm opacity-70">
                        <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-background/50">
                            <ImageIcon className="h-6 w-6" />
                            <span>Visual Evidence</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-background/50">
                            <MapIcon className="h-6 w-6" />
                            <span>Interactive Maps</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-background/50">
                            <ChartIcon className="h-6 w-6" />
                            <span>Data Charts</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-background/50">
                            <TableIcon className="h-6 w-6" />
                            <span>Data Tables</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col bg-background border-r overflow-hidden">
            {/* Header / Title Bar */}
            <div className="h-14 border-b flex items-center px-6 justify-between bg-card/50 backdrop-blur">
                <div className="flex items-center gap-2 font-medium">
                    {activeContent.type === 'image' && (
                        <>
                            <ImageIcon className="h-4 w-4 text-primary" />
                            <span>Visual Evidence</span>
                        </>
                    )}
                    {activeContent.type === 'map' && (
                        <>
                            <MapIcon className="h-4 w-4 text-primary" />
                            <span>Interactive Map</span>
                        </>
                    )}
                    {activeContent.type === 'chart' && (
                        <>
                            <ChartIcon className="h-4 w-4 text-primary" />
                            <span>Data Chart</span>
                        </>
                    )}
                    {activeContent.type === 'data_sample' && (
                        <>
                            <TableIcon className="h-4 w-4 text-primary" />
                            <span>Data Sample</span>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
                {activeContent.type === 'image' && (
                    <div className="h-full w-full p-4">
                        {/* Check if this is an attached image (no doclingJsonPath) */}
                        {!activeContent.data.doclingJsonPath && imageBase64 ? (
                            <div className="flex justify-center items-center h-full bg-muted/30 rounded-lg">
                                <img
                                    src={`data:${imageMimeType || 'image/png'};base64,${imageBase64}`}
                                    alt={activeContent.data.source || "Attached image"}
                                    className="max-w-full max-h-full object-contain rounded border shadow-sm"
                                />
                            </div>
                        ) : (
                            <VisualEvidenceContent evidence={activeContent.data} />
                        )}
                    </div>
                )}

                {activeContent.type === 'map' && (
                    <div className="h-full w-full p-4">
                        {activeContent.htmlUrl ? (
                            <iframe
                                src={activeContent.htmlUrl}
                                title="Interactive Map"
                                className="w-full h-full border rounded-lg shadow-md"
                                style={{ minHeight: '500px' }}
                            />
                        ) : activeContent.imageUrl ? (
                            <div className="flex justify-center items-center h-full bg-muted/30 rounded-lg">
                                <img
                                    src={activeContent.imageUrl}
                                    alt="Map"
                                    className="max-w-full max-h-full object-contain rounded border shadow-sm"
                                />
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <MapIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                    <p>No map data available</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeContent.type === 'chart' && (
                    <div className="h-full w-full p-4 flex justify-center items-center bg-muted/30 rounded-lg">
                        <img
                            src={`data:${activeContent.mimeType || 'image/png'};base64,${activeContent.base64}`}
                            alt="Generated Chart"
                            className="max-w-full max-h-full object-contain rounded border shadow-sm"
                        />
                    </div>
                )}

                {activeContent.type === 'data_sample' && (
                    <div className="h-full flex flex-col p-6 overflow-hidden" style={{ contain: 'layout' }}>
                        <div className="mb-4 shrink-0">
                            <h3 className="font-semibold text-lg truncate" title={activeContent.filename}>{activeContent.filename}</h3>
                            <p className="text-sm text-muted-foreground">
                                Showing first 5 rows of {activeContent.totalRows.toLocaleString()} total rows
                            </p>
                        </div>

                        <div className="flex-1 border rounded overflow-auto bg-card shadow-sm" style={{ contain: 'content' }}>
                            <table className="min-w-full text-sm border-collapse">
                                <thead className="bg-muted/90 border-b">
                                    <tr>
                                        <th className="bg-muted/95 border-r px-3 py-2 text-center w-[60px] font-medium text-muted-foreground">
                                            #
                                        </th>
                                        {activeContent.columns.map((col, idx) => (
                                            <th key={idx} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[150px]" title={col}>
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeContent.data.map((row, rIdx) => (
                                        <tr key={rIdx} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                                            <td className="bg-card border-r px-3 py-2 text-center text-muted-foreground font-mono text-xs">
                                                {rIdx + 1}
                                            </td>
                                            {activeContent.columns.map((_, cIdx) => (
                                                <td key={cIdx} className="px-4 py-2 whitespace-nowrap min-w-[150px]" title={String(row[cIdx] ?? '')}>
                                                    {row[cIdx] !== null && row[cIdx] !== undefined ? String(row[cIdx]) : <span className="text-muted-foreground/40 italic">null</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
