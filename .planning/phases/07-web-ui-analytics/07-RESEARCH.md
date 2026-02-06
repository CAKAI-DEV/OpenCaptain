# Phase 7: Web UI & Analytics - Research

**Researched:** 2026-02-06
**Domain:** Next.js App Router with dashboard, task management, and analytics visualization
**Confidence:** HIGH

## Summary

This research covers building a web dashboard with Next.js 15+ App Router, integrating with an existing Hono/Bun API backend that uses JWT authentication. The phase requires task views (Kanban + list), project dashboards with health indicators, and multi-level analytics (individual/squad/project).

The standard approach is: Next.js 15 with App Router for the frontend, shadcn/ui for components (Tailwind-based, copied into codebase), dnd-kit for drag-and-drop Kanban, and Recharts for analytics visualization. Authentication integrates with the existing JWT-based backend via HTTP-only cookies for security.

Key architectural decisions: Use middleware for route protection (fast, runs before rendering), store JWT in HTTP-only cookies (secure, works with SSR), call the external API directly from Server Components where possible, and use React 19's useOptimistic for instant UI feedback on task operations.

**Primary recommendation:** Build a Next.js 15 App Router frontend with middleware-based auth, shadcn/ui components, dnd-kit Kanban with optimistic updates, and Recharts for analytics charts.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.0.0 | React framework with App Router | Industry standard, server components, great DX |
| react | ^19.0.0 | UI library | Required by Next.js 15, includes useOptimistic |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop primitives | Modern, accessible, tree-shakeable |
| @dnd-kit/sortable | ^9.0.0 | Sortable preset for Kanban | Built on @dnd-kit/core, handles reordering |
| recharts | ^2.15.0 | Chart library | React-native, declarative, 9M+ weekly downloads |
| tailwindcss | ^4.0.0 | Utility CSS framework | Required by shadcn/ui |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/utilities | ^3.2.2 | Drag-and-drop helpers | CSS transforms, array utilities |
| class-variance-authority | ^0.7.1 | Component variants | Required by shadcn/ui patterns |
| clsx | ^2.1.1 | Conditional classnames | Used with tailwind-merge |
| tailwind-merge | ^3.0.0 | Merge Tailwind classes | Prevents class conflicts |
| lucide-react | ^0.469.0 | Icon library | shadcn/ui default icon set |
| date-fns | ^4.1.0 | Date formatting | Charts, date ranges, timestamps |
| zod | ^3.24.0 | Schema validation | Form validation, API response typing |
| react-hook-form | ^7.54.0 | Form state management | Pairs with shadcn/ui form components |
| @hookform/resolvers | ^3.9.0 | Zod resolver for RHF | Connects zod schemas to forms |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Tremor | Tremor is higher-level, less customizable but faster to build |
| Recharts | Chart.js | Chart.js better for huge datasets, but less React-native |
| dnd-kit | react-beautiful-dnd | react-beautiful-dnd is deprecated, dnd-kit is the modern choice |
| tailwindcss | CSS modules | Tailwind required by shadcn/ui decision |

**Installation:**
```bash
# Create Next.js app (if new project)
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --turbopack

# Add shadcn/ui
npx shadcn@latest init

# Add shadcn components (as needed)
npx shadcn@latest add button card input form select dialog dropdown-menu

# Add drag-and-drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Add charts
npm install recharts

# Add form handling
npm install react-hook-form @hookform/resolvers zod

# Add date utilities
npm install date-fns
```

## Architecture Patterns

### Recommended Project Structure
```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Auth route group (no layout)
│   │   │   ├── login/page.tsx
│   │   │   └── magic-link/page.tsx
│   │   ├── (dashboard)/             # Dashboard route group (shared layout)
│   │   │   ├── layout.tsx           # Sidebar, header, auth guard
│   │   │   ├── page.tsx             # Dashboard home (project list)
│   │   │   ├── projects/
│   │   │   │   └── [projectId]/
│   │   │   │       ├── page.tsx     # Project overview
│   │   │   │       ├── board/page.tsx    # Kanban view
│   │   │   │       ├── list/page.tsx     # List view
│   │   │   │       └── analytics/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/                     # Next.js API routes (for auth only)
│   │   │   └── auth/
│   │   │       ├── login/route.ts   # Proxy to backend, set cookie
│   │   │       ├── logout/route.ts
│   │   │       └── refresh/route.ts
│   │   ├── layout.tsx               # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── board/                   # Kanban-specific components
│   │   │   ├── board-column.tsx
│   │   │   ├── board-task-card.tsx
│   │   │   └── kanban-board.tsx
│   │   ├── charts/                  # Analytics chart components
│   │   │   ├── velocity-chart.tsx
│   │   │   ├── burndown-chart.tsx
│   │   │   └── output-chart.tsx
│   │   └── common/                  # Shared components
│   │       ├── header.tsx
│   │       ├── sidebar.tsx
│   │       └── project-selector.tsx
│   ├── lib/
│   │   ├── api.ts                   # API client with auth
│   │   ├── auth.ts                  # Auth utilities (cookies, tokens)
│   │   └── utils.ts                 # cn() and helpers
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-tasks.ts
│   │   └── use-optimistic-task.ts
│   └── types/
│       ├── api.ts                   # API response types
│       └── task.ts
├── middleware.ts                    # Route protection
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### Pattern 1: Middleware Route Protection
**What:** Use Next.js middleware to protect routes before rendering
**When to use:** All authenticated routes
**Example:**
```typescript
// middleware.ts
// Source: https://nextjs.org/docs/app/building-your-application/routing/middleware
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/magic-link', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const token = request.cookies.get('access_token')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Optionally verify token expiry (JWT decode without verification is safe)
  // Full verification happens on API calls

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

### Pattern 2: JWT Cookie Auth with External API
**What:** Store JWT in HTTP-only cookie, forward to API calls
**When to use:** All authenticated API requests
**Example:**
```typescript
// src/lib/api.ts
// Source: https://github.com/vercel/next.js/discussions/69451

import { cookies } from 'next/headers'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!response.ok) {
    // Handle 401 - trigger refresh
    if (response.status === 401) {
      // Attempt refresh or redirect to login
      throw new AuthError('Session expired')
    }
    throw new ApiError(response.status, await response.json())
  }

  return response.json()
}

// For client components
export async function clientApiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Send cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.json())
  }

  return response.json()
}
```

### Pattern 3: Optimistic Updates with useOptimistic
**What:** Update UI immediately, rollback on error
**When to use:** Task status changes, drag-and-drop operations
**Example:**
```typescript
// src/hooks/use-optimistic-task.ts
// Source: https://react.dev/reference/react/useOptimistic

import { useOptimistic, useTransition } from 'react'
import { updateTask } from '@/lib/api'
import type { Task } from '@/types/task'

export function useOptimisticTasks(initialTasks: Task[]) {
  const [isPending, startTransition] = useTransition()

  const [optimisticTasks, addOptimisticUpdate] = useOptimistic(
    initialTasks,
    (state: Task[], update: { taskId: string; changes: Partial<Task> }) => {
      return state.map(task =>
        task.id === update.taskId
          ? { ...task, ...update.changes }
          : task
      )
    }
  )

  const updateTaskOptimistically = async (
    taskId: string,
    changes: Partial<Task>
  ) => {
    startTransition(async () => {
      // Optimistically update UI
      addOptimisticUpdate({ taskId, changes })

      try {
        // Make API call
        await updateTask(taskId, changes)
      } catch (error) {
        // On error, the optimistic state is automatically rolled back
        // when the transition completes without the update
        console.error('Failed to update task:', error)
        // Optionally show toast notification
      }
    })
  }

  return { tasks: optimisticTasks, updateTask: updateTaskOptimistically, isPending }
}
```

### Pattern 4: Kanban Board with dnd-kit
**What:** Sortable columns with draggable task cards
**When to use:** Board view (WEB-05)
**Example:**
```typescript
// src/components/board/kanban-board.tsx
// Source: https://docs.dndkit.com/presets/sortable

'use client'

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { BoardColumn } from './board-column'
import { BoardTaskCard } from './board-task-card'
import { useOptimisticTasks } from '@/hooks/use-optimistic-task'
import type { Task } from '@/types/task'

const COLUMNS = ['todo', 'in_progress', 'done'] as const

export function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const { tasks, updateTask } = useOptimisticTasks(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const newStatus = over.id as Task['status']

    const task = tasks.find(t => t.id === taskId)
    if (task && task.status !== newStatus) {
      updateTask(taskId, { status: newStatus })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto p-4">
        {COLUMNS.map(status => (
          <BoardColumn key={status} status={status}>
            <SortableContext
              items={tasks.filter(t => t.status === status).map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tasks
                .filter(t => t.status === status)
                .map(task => (
                  <BoardTaskCard key={task.id} task={task} />
                ))}
            </SortableContext>
          </BoardColumn>
        ))}
      </div>

      <DragOverlay>
        {activeTask && <BoardTaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
```

### Pattern 5: Analytics Charts with Recharts
**What:** Line, bar, and area charts for metrics visualization
**When to use:** Analytics pages (WEB-07, WEB-08, WEB-09)
**Example:**
```typescript
// src/components/charts/velocity-chart.tsx
// Source: https://recharts.org/en-US/examples

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface VelocityData {
  periodStart: string
  periodEnd: string
  velocity: number
}

export function VelocityChart({ data }: { data: VelocityData[] }) {
  const formattedData = data.map(d => ({
    ...d,
    label: new Date(d.periodStart).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Velocity Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-sm" />
              <YAxis className="text-sm" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="velocity"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Anti-Patterns to Avoid
- **Calling Route Handlers from Server Components:** Call async functions directly; both run on server
- **Using useSearchParams in Server Components:** Use searchParams prop instead
- **Placing Suspense inside async components:** Suspense must be higher than the fetching component
- **Adding "use client" unnecessarily:** Only mark components that need client-side features
- **Not revalidating after mutations:** Use revalidatePath() after Server Actions
- **Redirects inside try/catch:** redirect() throws internally, don't catch it

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom mouse event handling | @dnd-kit/core + @dnd-kit/sortable | Accessibility, keyboard support, mobile touch |
| Component styling | Custom CSS classes | shadcn/ui + Tailwind | Consistent design system, composable |
| Form validation | Manual error state | react-hook-form + zod | Performance, error handling, TypeScript |
| Class name merging | String concatenation | clsx + tailwind-merge | Handles class conflicts correctly |
| Date formatting | toLocaleString | date-fns | Consistent, timezone-aware, tree-shakeable |
| Chart rendering | Canvas/SVG drawing | Recharts | Responsive, declarative, React-native |
| Auth cookies | Manual cookie parsing | cookies() from next/headers | Type-safe, SSR-compatible |
| Route guards | useEffect redirect | middleware.ts | Runs before render, faster UX |

**Key insight:** The Next.js App Router ecosystem provides first-class solutions for most dashboard patterns. Custom solutions introduce bugs around SSR, hydration, and edge runtime compatibility.

## Common Pitfalls

### Pitfall 1: Fetching in Client Components
**What goes wrong:** Components fetch data client-side when server fetch would be better
**Why it happens:** Developer habit from SPA/Vite patterns
**How to avoid:** Default to Server Components; only add "use client" when needed (state, events, browser APIs)
**Warning signs:** useEffect with fetch calls for initial data load

### Pitfall 2: Cookie Mismatch Between Server and Client
**What goes wrong:** Server renders with auth state, client hydrates without it (flash of wrong content)
**Why it happens:** HTTP-only cookies accessible on server but not client JavaScript
**How to avoid:** Use consistent auth checking pattern; let middleware handle redirects, not client components
**Warning signs:** Layout shift on page load, auth-dependent content flashing

### Pitfall 3: Over-Using Client Components
**What goes wrong:** Large JavaScript bundle, slow initial load
**Why it happens:** Adding "use client" to entire page instead of isolating interactive parts
**How to avoid:** Split into Server Component (data fetching) + small Client Component (interaction)
**Warning signs:** "use client" at top of page components, large initial bundle

### Pitfall 4: Stale Data After Optimistic Updates
**What goes wrong:** UI shows optimistic state but never updates with server response
**Why it happens:** Not revalidating cache after mutation
**How to avoid:** Call revalidatePath() or revalidateTag() after successful mutations
**Warning signs:** Data appears correct but refresh shows different state

### Pitfall 5: Hydration Mismatch with Date/Time
**What goes wrong:** Server renders date in one timezone, client in another
**Why it happens:** Date.toLocaleString() differs between server and client
**How to avoid:** Use date-fns with explicit formatting, or render dates in Client Components only
**Warning signs:** Console hydration warnings about text content mismatch

### Pitfall 6: Drag-and-Drop Accessibility
**What goes wrong:** Keyboard users cannot reorder items
**Why it happens:** Using mouse-only drag implementation
**How to avoid:** dnd-kit includes KeyboardSensor; configure it properly
**Warning signs:** Tab navigation skips draggable items, no keyboard announcements

### Pitfall 7: Chart Performance with Large Datasets
**What goes wrong:** Charts render slowly or freeze the UI
**Why it happens:** Recharts re-renders entire chart on any data change
**How to avoid:** Memoize data, use appropriate chart type, consider pagination for large datasets
**Warning signs:** Laggy chart interactions, slow initial render

## Code Examples

### Login Page with Backend Integration
```typescript
// src/app/(auth)/login/page.tsx

import { LoginForm } from './login-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm callbackUrl={searchParams.callbackUrl} />
    </div>
  )
}

// src/app/(auth)/login/login-form.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

export function LoginForm({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const router = useRouter()
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (response.ok) {
      router.push(callbackUrl)
      router.refresh()
    } else {
      form.setError('root', { message: 'Invalid credentials' })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-80">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <Input type="email" {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <Input type="password" {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
```

### API Route for Login (Cookie Setting)
```typescript
// src/app/api/auth/login/route.ts

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API_BASE = process.env.API_URL || 'http://localhost:3000/api/v1'

export async function POST(request: Request) {
  const body = await request.json()

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return NextResponse.json(
      await response.json(),
      { status: response.status }
    )
  }

  const data = await response.json()
  const cookieStore = await cookies()

  // Set HTTP-only cookies
  cookieStore.set('access_token', data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 minutes
    path: '/',
  })

  cookieStore.set('refresh_token', data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return NextResponse.json({ user: data.user })
}
```

### Dashboard Layout with Auth Guard
```typescript
// src/app/(dashboard)/layout.tsx

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/common/sidebar'
import { Header } from '@/components/common/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')

  // Middleware should catch this, but double-check
  if (!token) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Health Indicator Card
```typescript
// src/components/common/health-card.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type HealthLevel = 'healthy' | 'warning' | 'critical'

interface HealthCardProps {
  title: string
  value: string | number
  health: HealthLevel
  description?: string
}

const healthColors: Record<HealthLevel, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
}

export function HealthCard({ title, value, health, description }: HealthCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn('h-3 w-3 rounded-full', healthColors[health])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router | App Router | Next.js 13 (2022) | Server Components, layouts, streaming |
| getServerSideProps | Server Components + async | Next.js 13+ | Simpler data fetching, no serialization |
| API Routes only | Server Actions | Next.js 14+ | Direct mutations from components |
| CSS Modules / Styled | Tailwind + shadcn/ui | 2023+ | Copy-paste components, full control |
| react-beautiful-dnd | @dnd-kit | 2021+ | Better accessibility, maintained |
| useState for optimistic | useOptimistic | React 19 (2024) | Built-in optimistic state management |
| Context for auth | Cookies + middleware | Next.js 13+ | Edge-compatible, no client JS needed |

**Deprecated/outdated:**
- react-beautiful-dnd: Deprecated, use dnd-kit
- Pages Router data fetching (getServerSideProps): Use Server Components
- next/router: Use next/navigation in App Router
- @next/font: Merged into next/font

## Open Questions

Things that couldn't be fully resolved:

1. **Token Refresh Strategy**
   - What we know: Refresh tokens stored in HTTP-only cookie, can refresh on 401
   - What's unclear: Best UX for refresh failure (silent retry vs redirect)
   - Recommendation: Implement silent refresh on 401 in API client, redirect to login after 3 failures

2. **Chart Library Bundle Size**
   - What we know: Recharts is ~300KB gzipped, uses D3 submodules
   - What's unclear: Whether tree-shaking eliminates unused chart types effectively
   - Recommendation: Import specific chart components, measure bundle with next/bundle-analyzer

3. **Next.js 15 vs 16**
   - What we know: Next.js 16 is now available with Turbopack stable by default
   - What's unclear: Whether to use Next.js 15 (as decided) or upgrade to 16
   - Recommendation: Start with Next.js 15 as per user decision; upgrade to 16 is straightforward if needed

## Sources

### Primary (HIGH confidence)
- [Next.js Official Docs - App Router](https://nextjs.org/docs/app) - Project structure, routing, data fetching
- [Vercel Blog - Common App Router Mistakes](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them) - Anti-patterns and fixes
- [shadcn/ui Docs](https://ui.shadcn.com/docs) - Installation, components
- [dnd-kit Docs](https://docs.dndkit.com) - Sortable preset, sensors
- [React Docs - useOptimistic](https://react.dev/reference/react/useOptimistic) - Hook API, usage patterns
- [Recharts npm](https://www.npmjs.com/package/recharts) - Version 2.15.0 confirmed

### Secondary (MEDIUM confidence)
- [GitHub Discussions - Next.js External API Auth](https://github.com/vercel/next.js/discussions/69451) - JWT token management patterns
- [LogRocket - Kanban with dnd-kit](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) - Implementation patterns
- [Syncfusion - React Chart Libraries Comparison](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) - Recharts vs alternatives

### Tertiary (LOW confidence)
- [Twitter/X - dnd-kit with useOptimistic](https://x.com/codinginflow/status/1896099774862151835) - Community example of combined pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm, official docs, and widespread usage
- Architecture: HIGH - Patterns from official Next.js docs and Vercel best practices
- Pitfalls: HIGH - Sourced from official Vercel blog post on common mistakes

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable ecosystem)

## Discretionary Recommendations

Based on research, here are recommendations for areas marked as "Claude's discretion":

### Auth State Management
**Recommendation:** Server+client hybrid with HTTP-only cookies
- Store JWT access token in HTTP-only cookie (secure, SSR-compatible)
- Middleware checks cookie presence for route protection (fast, before render)
- Server Components read cookie directly for data fetching
- Client Components use /api/auth endpoints which proxy to backend

### Route Protection
**Recommendation:** Middleware-based protection
- Middleware runs at edge before any rendering
- Faster UX than layout-level guards
- Centralized auth logic in one file
- Layout can add secondary checks for role-based access

### API Call Pattern
**Recommendation:** Hybrid approach
- Server Components: Call external API directly with token from cookies
- Client Components: Call Next.js API routes which proxy to backend
- Rationale: Server calls are faster (no extra hop), client calls benefit from cookie handling

### Login UX
**Recommendation:** Include both password and magic link
- Backend already supports both (verified in auth.routes.ts)
- Password for quick access, magic link for passwordless option
- Magic link callback sets cookies same as password login

### Chart Library
**Recommendation:** Recharts
- Best React integration (declarative components)
- 9M+ weekly downloads, actively maintained
- Sufficient for our chart types (line, bar, area)
- Tremor is higher-level but less flexible
- Chart.js would be overkill for our data volumes

### Analytics Layout
**Recommendation:** Role-based single view with sections
- One analytics page per role scope (individual, squad, project)
- Sections within page for different metrics
- Date range picker at top affects all charts
- Simpler than tabbed interface, clearer information hierarchy

### Date Range Picker
**Recommendation:** Presets + custom picker
- Presets for common ranges (7d, 30d, 90d, this sprint)
- Custom picker for specific date ranges
- Use shadcn/ui Calendar component for picker

### Health Indicators
**Recommendation:** Color-coded cards with dot indicator
- Cards show metric value prominently
- Small colored dot (green/yellow/red) indicates health
- Subtle but clear visual hierarchy
- Cards can expand to show trend if needed

### Project Selection
**Recommendation:** Header dropdown
- Projects visible in header, always accessible
- Dropdown with project list + search
- Fewer projects expected per user (< 20)
- Sidebar for navigation within project
