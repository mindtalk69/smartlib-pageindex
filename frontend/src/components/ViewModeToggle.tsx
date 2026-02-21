/**
 * Toggle between Classic and Sidebar chat views.
 * Single button that cycles between modes, similar to theme toggle.
 */

import { Button } from "@/components/ui/button";
import { LayoutTemplate, PanelRight } from "lucide-react";

export type ViewMode = "classic" | "sidebar";

interface ViewModeToggleProps {
    mode: ViewMode;
    onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
    const toggleMode = () => {
        onChange(mode === "classic" ? "sidebar" : "classic");
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            className="h-9 w-9"
            title={mode === "classic" ? "Switch to Sidebar View" : "Switch to Classic View"}
        >
            {mode === "classic" ? (
                <LayoutTemplate className="h-4 w-4" />
            ) : (
                <PanelRight className="h-4 w-4" />
            )}
        </Button>
    );
}
