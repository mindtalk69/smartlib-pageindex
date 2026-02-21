import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Users,
  Upload,
  MessageCircle,
  Clock,
  HardDrive,
  Shield,
  Calendar,
  Activity,
  ArrowLeft
} from "lucide-react";

interface UserData {
  user_id: string;
  username: string;
  email: string | null;
  auth_provider: string;
  profile_picture_url: string | null;
  is_admin: boolean;
  is_disabled: boolean;
  created_at: string | null;
}

interface GroupDetail {
  group_id: number;
  name: string;
  description: string | null;
  joined_at: string | null;
  member_count: number;
}

interface UploadData {
  file_id: number;
  filename: string;
  size: number;
  uploaded_at: string | null;
  knowledge_id: number | null;
  library_id: number | null;
}

interface ThreadData {
  thread_id: string;
  last_message: string;
  timestamp: string | null;
  role: string;
}

interface ProfileData {
  user: UserData;
  groups: {
    count: number;
    names: string[];
    details: GroupDetail[];
  };
  activity: {
    uploads: {
      total_count: number;
      total_size_bytes: number;
      total_size_mb: number;
      recent: UploadData[];
    };
    conversations: {
      total_messages: number;
      total_threads: number;
      recent_threads: ThreadData[];
    };
  };
}

export function UserProfile() {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/profile', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAuthProviderLabel = (provider: string) => {
    const providers: Record<string, string> = {
      'local': 'Local',
      'azure': 'Azure AD',
      'google': 'Google'
    };
    return providers[provider] || provider;
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error || 'Failed to load profile'}
        </div>
      </div>
    );
  }

  const { user, groups, activity } = profileData;

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/app')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Chat
        </Button>
      </div>

      {/* Header with Avatar */}
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          {user.profile_picture_url ? (
            <AvatarImage src={user.profile_picture_url} alt={user.username} />
          ) : null}
          <AvatarFallback className="text-2xl">
            {getUserInitials(user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{user.username}</h1>
          <p className="text-muted-foreground">
            {user.email || 'View your account information and activity'}
          </p>
        </div>
      </div>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <p className="text-lg font-semibold">{user.username}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-lg">{user.email || 'Not provided'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">User ID</label>
              <p className="text-sm font-mono">{user.user_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Authentication</label>
              <Badge variant="secondary" className="mt-1">
                {getAuthProviderLabel(user.auth_provider)}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Status</label>
              <div className="flex gap-2 mt-1">
                {user.is_admin && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
                {user.is_disabled ? (
                  <Badge variant="destructive">Disabled</Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Member Since</label>
              <p className="text-sm flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(user.created_at)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Memberships
            <Badge variant="secondary">{groups.count}</Badge>
          </CardTitle>
          <CardDescription>
            Groups determine which knowledge bases and libraries you can access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.count === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>You are not a member of any groups</p>
              <p className="text-sm">Contact your administrator to request group access</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.details.map((group) => (
                <div
                  key={group.group_id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{group.name}</h4>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {group.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {group.member_count} members
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Joined {formatDate(group.joined_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="uploads">
            <Upload className="h-4 w-4 mr-2" />
            Uploads
          </TabsTrigger>
          <TabsTrigger value="conversations">
            <MessageCircle className="h-4 w-4 mr-2" />
            Conversations
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Total Uploads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.uploads.total_count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.uploads.total_size_mb.toFixed(2)} MB total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Storage Used
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBytes(activity.uploads.total_size_bytes)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {activity.uploads.total_count} files
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Conversations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activity.conversations.total_threads}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.conversations.total_messages} messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Groups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{groups.count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {groups.names.slice(0, 2).join(', ')}
                  {groups.count > 2 && ` +${groups.count - 2}`}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Uploads Tab */}
        <TabsContent value="uploads">
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>
                Your 10 most recent file uploads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activity.uploads.recent.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No uploads yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.uploads.recent.map((upload) => (
                    <div
                      key={upload.file_id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{upload.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatBytes(upload.size)} • {formatDate(upload.uploaded_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
              <CardDescription>
                Your 5 most recent conversation threads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activity.conversations.recent_threads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.conversations.recent_threads.map((thread) => (
                    <div
                      key={thread.thread_id}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {thread.thread_id}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(thread.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {thread.last_message}
                        {thread.last_message.length >= 100 && '...'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
