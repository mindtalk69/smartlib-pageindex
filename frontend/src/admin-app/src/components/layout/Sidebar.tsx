import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Settings,
  MessageSquare,
  Database,
  FileText,
  Key,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

const menuItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/users", icon: Users, label: "Users" },
  { path: "/password-reset-requests", icon: Key, label: "Password Resets" },
  { path: "/llm-providers", icon: MessageSquare, label: "LLM Providers" },
  { path: "/models", icon: Database, label: "Models" },
  { path: "/languages", icon: FileText, label: "Languages" },
  { path: "/content", icon: FileText, label: "Content" },
  { path: "/settings", icon: Settings, label: "Settings" },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-muted/50">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">SmartLib Admin</h1>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
