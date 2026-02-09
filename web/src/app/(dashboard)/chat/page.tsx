'use client';

import { Bot, MessageSquare, Plus, Send, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { conversationsApi } from '@/lib/api/conversations';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/types/conversation';

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setCurrentUser(d.user))
      .catch(() => {});
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await conversationsApi.list({ limit: 50 });
      // Backend returns { data: [...] }
      const list = (res as { data?: Conversation[] }).data || (res as unknown as Conversation[]);
      setConversations(Array.isArray(list) ? list : []);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    try {
      const res = await conversationsApi.get(conv.id);
      // Backend returns conversation object directly (no data wrapper)
      const data = (res as { data?: Conversation }).data || (res as unknown as Conversation);
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await conversationsApi.create({ title: 'New conversation' });
      // Backend returns { id: "..." } directly (no data wrapper)
      const created = (res as { data?: { id: string } }).data || (res as unknown as { id: string });
      const newConv: Conversation = {
        id: created.id,
        userId: '',
        projectId: null,
        title: 'New conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversation(newConv);
      setMessages([]);
    } catch {
      // Handle error
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    let convId = activeConversation?.id;

    if (!convId) {
      try {
        const res = await conversationsApi.create({ title: input.trim().slice(0, 50) });
        // Backend returns { id: "..." } directly (no data wrapper)
        const created =
          (res as { data?: { id: string } }).data || (res as unknown as { id: string });
        convId = created.id;
        const newConv: Conversation = {
          id: convId,
          userId: '',
          projectId: null,
          title: input.trim().slice(0, 50),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversation(newConv);
      } catch {
        return;
      }
    }

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await conversationsApi.sendMessage(convId, userMsg.content);
      // Backend returns { message: {...}, context: {...}, usage: {...} } directly
      const msg =
        (res as { data?: { message: Message } }).data?.message ||
        (res as unknown as { message: Message }).message;
      const assistantMsg: Message = {
        id: msg?.id || `ai-${Date.now()}`,
        conversationId: convId as string,
        role: 'assistant',
        content: msg?.content || 'No response received.',
        createdAt: msg?.createdAt || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          conversationId: convId as string,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6">
      {/* Conversation Sidebar */}
      <div className="w-72 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button className="w-full" size="sm" onClick={handleNewConversation}>
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No conversations yet
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  type="button"
                  key={conv.id}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors',
                    activeConversation?.id === conv.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => loadConversation(conv)}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{conv.title || 'Untitled'}</span>
                  </div>
                  <div className="text-xs opacity-60 mt-0.5 pl-6">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentUser && (
          <div className="border-b bg-muted/50 px-4 py-2 flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Chatting as</span>
            <span className="font-medium">{currentUser.email}</span>
          </div>
        )}
        {!activeConversation && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">BlockBot AI Assistant</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Ask me anything about your projects. I can help with task management, status
                updates, generating reports, and more.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  "What's the status of our sprint?",
                  'Show me overdue tasks',
                  'Generate a weekly recap',
                  'Who has the most tasks?',
                ].map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    className="p-3 rounded-lg border text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role !== 'user' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-4 py-2.5 text-sm">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                      <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                      <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.3s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              placeholder="Ask BlockBot anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
