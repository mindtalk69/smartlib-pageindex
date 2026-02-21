import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Settings, Upload, Info, LogOut, Lock, Plus, UserCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface NavigationMenuProps {
  isAdmin?: boolean;
  username?: string;
  profilePictureUrl?: string | null;
  onNewConversation?: () => void;
}

/**
 * NavigationMenu Component
 *
 * User dropdown menu with Admin Panel, About, Logout links.
 * Uses shadcn/ui DropdownMenu and Lucide icons.
 */
export function NavigationMenu({
  isAdmin = false,
  username = "User",
  profilePictureUrl = null,
  onNewConversation,
}: NavigationMenuProps) {
  const handleLogout = async () => {
    try {
      await fetch("/logout", {
        method: "GET",
        credentials: "include",
      });
      window.location.href = "/app/login";
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = "/app/login";
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {profilePictureUrl ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={profilePictureUrl} alt={username} />
              <AvatarFallback>{getUserInitials(username)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-4 w-4" />
          )}
          {username}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onNewConversation} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-2" /> New Conversation
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
            <UserCircle className="h-4 w-4" /> My Profile
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <a href="/admin" className="flex items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4" /> Admin Panel
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/upload" className="flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" /> Upload Documents
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/change-password" className="flex items-center gap-2 cursor-pointer">
            <Lock className="h-4 w-4" /> Change Password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/about" className="flex items-center gap-2 cursor-pointer">
            <Info className="h-4 w-4" /> About
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
