'use client';

import { Bell, Loader2, Mail, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api/index';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  slack: boolean;
}

const SETTING_DEFINITIONS: Array<{ id: string; label: string; description: string }> = [
  { id: 'task_assigned', label: 'Task Assigned', description: 'When a task is assigned to you' },
  {
    id: 'task_completed',
    label: 'Task Completed',
    description: 'When a task you created is completed',
  },
  {
    id: 'deadline_approaching',
    label: 'Deadline Approaching',
    description: '24 hours before a deadline',
  },
  {
    id: 'deadline_missed',
    label: 'Deadline Missed',
    description: 'When a task deadline is missed',
  },
  { id: 'mention', label: 'Mentions', description: 'When someone mentions you in a comment' },
  { id: 'check_in', label: 'Check-in Reminders', description: 'Scheduled check-in notifications' },
];

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await api.get<{ data: NotificationSetting[] }>('/me/notification-preferences');
      if (res.data && res.data.length > 0) {
        setSettings(res.data);
        return;
      }
    } catch {
      // API may not exist yet — use defaults with all off
    }
    // Fallback: initialize from definitions with all channels off
    setSettings(
      SETTING_DEFINITIONS.map((def) => ({
        ...def,
        email: false,
        push: false,
        slack: false,
      }))
    );
    setIsFetching(false);
  }, []);

  useEffect(() => {
    loadPreferences().finally(() => setIsFetching(false));
  }, [loadPreferences]);

  const toggleSetting = (id: string, channel: 'email' | 'push' | 'slack') => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, [channel]: !s[channel] } : s)));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await api.patch('/me/notification-preferences', { settings });
      toast({ title: 'Notification preferences saved' });
    } catch {
      toast({ title: 'Failed to save preferences', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">Choose how you want to be notified</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>Configure which notifications you receive and how</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_80px_80px_80px] items-center gap-4 pb-2 border-b">
                <div className="font-medium text-sm">Event</div>
                <div className="text-center">
                  <Mail className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Email</span>
                </div>
                <div className="text-center">
                  <Bell className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Push</span>
                </div>
                <div className="text-center">
                  <MessageSquare className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Slack</span>
                </div>
              </div>

              {/* Settings rows */}
              {settings.map((setting) => (
                <div
                  key={setting.id}
                  className="grid grid-cols-[1fr_80px_80px_80px] items-center gap-4"
                >
                  <div>
                    <Label className="font-medium">{setting.label}</Label>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.email}
                      onClick={() => toggleSetting(setting.id, 'email')}
                      className={`h-6 w-11 rounded-full transition-colors ${
                        setting.email ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                          setting.email ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.push}
                      onClick={() => toggleSetting(setting.id, 'push')}
                      className={`h-6 w-11 rounded-full transition-colors ${
                        setting.push ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                          setting.push ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={setting.slack}
                      onClick={() => toggleSetting(setting.id, 'slack')}
                      className={`h-6 w-11 rounded-full transition-colors ${
                        setting.slack ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                          setting.slack ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <Button onClick={handleSave} disabled={isLoading || isFetching}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slack Integration</CardTitle>
          <CardDescription>Connect your Slack workspace for notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Slack</p>
                <p className="text-sm text-muted-foreground">Not connected</p>
              </div>
            </div>
            <Button variant="outline">Connect Slack</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
