import {
  LayoutDashboard,
  HelpCircle,
  Bell,
  Package,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Users,
  Command,
  Monitor,
  FileText,
  FolderUp,
  Download,
  Database,
  Cpu,
  Layers,
  Eye,
  Search,
  MessageSquare,
  ThumbsUp,
  RotateCcw,
  Image,
  Sparkles,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin',
    email: 'admin@smartlib.com',
    avatar: undefined, // Use fallback initials instead of missing image
  },
  teams: [
    {
      name: 'SmartLib Admin',
      logo: Command,
      plan: 'Administration',
    },
  ],
  navGroups: [
    {
      title: 'Menu',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'User & Groups',
      items: [
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Reset Requests',
          url: '/reset-requests',
          icon: RotateCcw,
        },
        {
          title: 'User Groups',
          url: '/user-groups',
          icon: Users,
        },
        {
          title: 'Groups',
          url: '/groups',
          icon: Users,
        },
        {
          title: 'Change Password',
          url: '/change-password',
          icon: Wrench,
        },
      ],
    },
    {
      title: 'Data Management',
      items: [
        {
          title: 'Files',
          url: '/files',
          icon: FileText,
        },
        {
          title: 'URL Downloads',
          url: '/url-downloads',
          icon: Download,
        },
        {
          title: 'Folder Upload',
          url: '/folder-upload',
          icon: FolderUp,
        },
        {
          title: 'Libraries',
          url: '/libraries',
          icon: Package,
        },
        {
          title: 'Catalogs',
          url: '/catalogs',
          icon: Package,
        },
        {
          title: 'Categories',
          url: '/categories',
          icon: Package,
        },
        {
          title: 'Knowledge Base',
          url: '/knowledges',
          icon: Database,
        },
        {
          title: 'LLM Languages',
          url: '/languages',
          icon: FileText,
        },
      ],
    },
    {
      title: 'AI Services',
      items: [
        {
          title: 'Prompts',
          url: '/prompts',
          icon: Sparkles,
        },
        {
          title: 'Vector References',
          url: '/vector-references',
          icon: Layers,
        },
        {
          title: 'Vector Settings',
          url: '/vector-settings',
          icon: Settings,
        },
        {
          title: 'OCR Settings',
          url: '/ocr-settings',
          icon: Image,
        },
        {
          title: 'Visual Grounding Activity',
          url: '/visual-grounding-activity',
          icon: Eye,
        },
        {
          title: 'Visual Grounding Settings',
          url: '/visual-grounding-settings',
          icon: Eye,
        },
        {
          title: 'LLM Providers',
          url: '/providers',
          icon: Cpu,
        },
        {
          title: 'LLM Models',
          url: '/models',
          icon: Cpu,
        },
        {
          title: 'Embedding Models',
          url: '/embedding-models',
          icon: Cpu,
        },
        {
          title: 'Search API Settings',
          url: '/search-api',
          icon: Search,
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          title: 'Message History',
          url: '/message-history',
          icon: MessageSquare,
        },
        {
          title: 'Feedback',
          url: '/feedback',
          icon: ThumbsUp,
        },
        {
          title: 'Reset Data',
          url: '/reset-data',
          icon: RotateCcw,
        },
        {
          title: 'App Settings',
          url: '/app-settings',
          icon: Settings,
        },
        {
          title: 'Logo Settings',
          url: '/logo-settings',
          icon: Palette,
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
