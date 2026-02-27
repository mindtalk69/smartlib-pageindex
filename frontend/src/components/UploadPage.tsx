import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Upload,
    Link,
    Loader2,
    MessageSquare,
    Settings,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploadTab } from "./upload/FileUploadTab";
import { UrlDownloadTab } from "./upload/UrlDownloadTab";
import { UploadProgress } from "./upload/UploadProgress";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "./SettingsPanel";
import { NavigationMenu } from "./NavigationMenu";
import { useNavigate } from "react-router-dom";
import api from "@/utils/apiClient";

interface Library {
    library_id: number;
    name: string;
    knowledges?: Knowledge[];
}

interface Knowledge {
    id: number;
    name: string;
    categories?: { id: number; name: string }[];
    catalogs?: { id: number; name: string }[];
    groups?: { group_id: number; name: string }[];
}

interface UploadTask {
    task_id: string;
    filename: string;
    status: string;
    info?: {
        stage?: string;
        progress?: number;
        message?: string;
    };
}

export function UploadPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("files");
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTasks, setActiveTasks] = useState<UploadTask[]>([]);
    const [vectorStoreMode, setVectorStoreMode] = useState<string>("user");
    const [visualGroundingEnabled, setVisualGroundingEnabled] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [username, setUsername] = useState<string>("User");
    const [branding, setBranding] = useState<{
        logo_url?: string;
        app_name?: string;
    }>({});
    const autoDismissedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Auto-dismiss SUCCESS tasks after a 5 second delay so the user can see them finish
        activeTasks.forEach((task) => {
            if (task.status === "SUCCESS" && !autoDismissedRef.current.has(task.task_id)) {
                autoDismissedRef.current.add(task.task_id);
                setTimeout(() => {
                    handleTaskComplete(task.task_id);
                    api.post(`/api/upload-status/${task.task_id}/dismiss`).catch(console.error);
                }, 5000);
            }
        });
    }, [activeTasks]);

    useEffect(() => {
        fetchLibraries();
        fetchConfig();
        fetchBranding();
        const interval = setInterval(fetchUploadStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchBranding = async () => {
        try {
            const data = await api.get<{ logo_url?: string; app_name?: string }>("/branding");
            setBranding(data);
        } catch (error) {
            console.error("Failed to fetch branding:", error);
        }
    };

    const fetchLibraries = async () => {
        try {
            setLoading(true);
            const data = await api.get<{ libraries: Library[] }>("/libraries");
            setLibraries(data.libraries || []);
        } catch (error) {
            console.error("Failed to fetch libraries:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const data = await api.get<{
                vector_store_mode?: string;
                visual_grounding_enabled?: boolean;
                is_admin?: boolean;
                username?: string;
            }>("/api/config");
            setVectorStoreMode(data.vector_store_mode || "user");
            setVisualGroundingEnabled(data.visual_grounding_enabled || false);
            setIsAdmin(data.is_admin || false);
            setUsername(data.username || "User");
        } catch (error) {
            console.error("Failed to fetch config:", error);
        }
    };

    const fetchUploadStatus = async () => {
        try {
            const data = await api.get<{ tasks: UploadTask[] }>("/upload-status");
            setActiveTasks(data.tasks || []);
        } catch (error) {
            console.error("Failed to fetch upload status:", error);
        }
    };

    const handleTaskComplete = (taskId: string) => {
        setActiveTasks((tasks) => tasks.filter((t) => t.task_id !== taskId));
    };

    const tabVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
        },
        exit: {
            opacity: 0,
            y: -20,
        },
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center px-4">
                    {/* Left: Logo + Title */}
                    <div className="flex items-center gap-2">
                        {branding.logo_url && (
                            <img
                                src={branding.logo_url}
                                alt={branding.app_name || "SmartLib"}
                                className="h-8 w-8 object-contain"
                            />
                        )}
                        <h1 className="text-lg font-semibold">
                            {branding.app_name || "SmartLib"} Upload
                        </h1>
                    </div>

                    {/* Center: Navigation */}
                    <nav className="flex items-center gap-1 mx-auto">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/")}
                            className="gap-2"
                        >
                            <MessageSquare className="h-4 w-4" />
                            Chat
                        </Button>
                        {isAdmin && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    (window.location.href = "/admin")
                                }
                                className="gap-2"
                            >
                                <Settings className="h-4 w-4" />
                                Admin
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                (window.location.href = "/about")
                            }
                            className="gap-2"
                        >
                            <Info className="h-4 w-4" />
                            About
                        </Button>
                    </nav>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <NavigationMenu isAdmin={isAdmin} username={username} />
                    </div>
                </div>
            </header>


            {/* Main Content */}
            <div className="container mx-auto py-8 px-4 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                                Upload & Download
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Upload files or download from URLs to your
                                knowledge base
                            </p>
                        </div>
                        {vectorStoreMode === "knowledge" && (
                            <Badge variant="outline" className="text-xs">
                                Mode: {vectorStoreMode}
                            </Badge>
                        )}
                    </div>

                    {/* Active Tasks Progress Panel */}
                    <AnimatePresence>
                        {activeTasks.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mb-6"
                            >
                                <UploadProgress
                                    tasks={activeTasks}
                                    onTaskComplete={handleTaskComplete}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Upload Content</CardTitle>
                            <CardDescription>
                                Choose between uploading files from your device
                                or downloading content from URLs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs
                                value={activeTab}
                                onValueChange={setActiveTab}
                                className="w-full"
                            >
                                <TabsList className="grid w-full grid-cols-2 mb-6">
                                    <TabsTrigger
                                        value="files"
                                        className="flex items-center gap-2"
                                    >
                                        <Upload className="h-4 w-4" />
                                        File Upload
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="urls"
                                        className="flex items-center gap-2"
                                    >
                                        <Link className="h-4 w-4" />
                                        Download from URL
                                    </TabsTrigger>
                                </TabsList>

                                <AnimatePresence mode="wait">
                                    <TabsContent value="files" className="mt-0">
                                        {activeTab === "files" && (
                                            <motion.div
                                                key="files-tab"
                                                variants={tabVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                            >
                                                {loading ? (
                                                    <div className="flex items-center justify-center py-12">
                                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : (
                                                    <FileUploadTab
                                                        libraries={libraries}
                                                        vectorStoreMode={
                                                            vectorStoreMode
                                                        }
                                                        visualGroundingEnabled={
                                                            visualGroundingEnabled
                                                        }
                                                        isAdmin={isAdmin}
                                                        onUploadStart={
                                                            fetchUploadStatus
                                                        }
                                                    />
                                                )}
                                            </motion.div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="urls" className="mt-0">
                                        {activeTab === "urls" && (
                                            <motion.div
                                                key="urls-tab"
                                                variants={tabVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                            >
                                                {loading ? (
                                                    <div className="flex items-center justify-center py-12">
                                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : (
                                                    <UrlDownloadTab
                                                        libraries={libraries}
                                                        vectorStoreMode={
                                                            vectorStoreMode
                                                        }
                                                        onDownloadStart={
                                                            fetchUploadStatus
                                                        }
                                                    />
                                                )}
                                            </motion.div>
                                        )}
                                    </TabsContent>
                                </AnimatePresence>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Info Section */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="mt-6 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground"
                    >
                        <p className="font-medium mb-2">
                            Supported File Types:
                        </p>
                        <p>
                            PDF, DOCX, XLSX, PPTX, MD, HTML, CSV, PNG, JPEG,
                            JPG, TIFF, BMP, TXT, ODT
                        </p>
                    </motion.div>
                </motion.div>
            </div>

            {/* Toaster for notifications */}
            <Toaster />
        </div>
    );
}
