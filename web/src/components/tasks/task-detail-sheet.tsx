'use client';

import { Calendar, Clock, Flag, MessageSquare, Send, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { tasksApi } from '@/lib/api/tasks';
import type { Comment } from '@/types/comment';
import type { Task, TaskPriority, TaskStatus } from '@/types/task';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdate?: (task: Task) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export function TaskDetailSheet({ task, open, onOpenChange, onTaskUpdate }: TaskDetailSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [subtasks, setSubtasks] = useState<Task[]>([]);

  const loadComments = useCallback(async () => {
    if (!task) return;
    setLoadingComments(true);
    try {
      const res = await tasksApi.getComments(task.id);
      setComments(res.data || []);
    } catch {
      // Comments may not be available
    } finally {
      setLoadingComments(false);
    }
  }, [task]);

  const loadSubtasks = useCallback(async () => {
    if (!task) return;
    try {
      const res = await tasksApi.list({ projectId: task.projectId, parentTaskId: task.id });
      setSubtasks(res.data || []);
    } catch {
      // Subtasks may not exist
    }
  }, [task]);

  useEffect(() => {
    if (task && open) {
      loadComments();
      loadSubtasks();
      setEditTitle(task.title);
      setEditDescription(task.description || '');
    }
  }, [task, open, loadComments, loadSubtasks]);

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task) return;
    try {
      const res = await tasksApi.update(task.id, { status });
      onTaskUpdate?.(res.data);
    } catch {
      // Handle error silently
    }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    if (!task) return;
    try {
      const res = await tasksApi.update(task.id, { priority });
      onTaskUpdate?.(res.data);
    } catch {
      // Handle error silently
    }
  };

  const handleSaveEdit = async () => {
    if (!task) return;
    try {
      const res = await tasksApi.update(task.id, {
        title: editTitle,
        description: editDescription || null,
      });
      onTaskUpdate?.(res.data);
      setIsEditing(false);
    } catch {
      // Handle error silently
    }
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await tasksApi.addComment(task.id, newComment.trim());
      setNewComment('');
      loadComments();
    } catch {
      // Handle error silently
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          {isEditing ? (
            <div className="space-y-3 pr-8">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-lg font-semibold"
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="pr-8">
              <SheetTitle
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditing(true)}
              >
                {task.title}
              </SheetTitle>
              {task.description && (
                <p
                  className="text-sm text-muted-foreground mt-2 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => setIsEditing(true)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
                >
                  {task.description}
                </p>
              )}
              {!task.description && (
                <p
                  className="text-sm text-muted-foreground mt-2 cursor-pointer hover:text-foreground transition-colors italic"
                  onClick={() => setIsEditing(true)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
                >
                  Click to add description...
                </p>
              )}
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 space-y-6">
            {/* Properties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Status
                </span>
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Flag className="h-3 w-3" />
                  Priority
                </span>
                <Select value={task.priority} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Assignee
                </span>
                <div className="text-sm text-muted-foreground h-8 flex items-center">
                  {task.assigneeId ? 'Assigned' : 'Unassigned'}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Due Date
                </span>
                <div className="text-sm h-8 flex items-center">
                  {task.dueDate ? (
                    new Date(task.dueDate).toLocaleDateString()
                  ) : (
                    <span className="text-muted-foreground">No due date</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Badge variant="secondary" className={priorityColors[task.priority]}>
                {task.priority}
              </Badge>
              <Badge variant="outline">{statusLabels[task.status]}</Badge>
            </div>

            {/* Subtasks */}
            {subtasks.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">Subtasks ({subtasks.length})</h4>
                  <div className="space-y-2">
                    {subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-3 p-2 rounded-md border text-sm"
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${
                            subtask.status === 'done'
                              ? 'bg-green-500'
                              : subtask.status === 'in_progress'
                                ? 'bg-blue-500'
                                : 'bg-gray-300'
                          }`}
                        />
                        <span
                          className={
                            subtask.status === 'done' ? 'line-through text-muted-foreground' : ''
                          }
                        >
                          {subtask.title}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {statusLabels[subtask.status]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Comments */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Comments
              </h4>

              {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {(comment.email || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{comment.email || 'User'}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Comment Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
