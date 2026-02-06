# Contributing to OpenCaptain

First off, thank you for considering contributing to OpenCaptain! It's people like you that make OpenCaptain a great tool for teams everywhere.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Convention](#commit-convention)
- [Need Help?](#need-help)

---

## Code of Conduct

This project follows a simple code of conduct:

- **Be respectful**: Treat everyone with respect. No harassment, discrimination, or toxic behavior.
- **Be constructive**: Provide helpful feedback. Critique ideas, not people.
- **Be patient**: Remember that everyone was a beginner once.
- **Be collaborative**: We're building something together.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- [Bun](https://bun.sh) 1.0+ installed
- [Docker](https://docker.com) and Docker Compose (for local services)
- [Git](https://git-scm.com) for version control
- A code editor (we recommend VS Code with Biome extension)

### First-Time Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/openminion.git
   cd openminion
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/openminion/openminion.git
   ```

4. **Install dependencies**
   ```bash
   bun install
   ```

5. **Start local services**
   ```bash
   docker-compose up -d postgres redis
   ```

6. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

7. **Run migrations**
   ```bash
   bun run db:migrate
   ```

8. **Verify everything works**
   ```bash
   bun run dev
   bun run test
   ```

---

## Development Setup

### Environment Variables

For development, you'll need:

```bash
# Required
DATABASE_URL=postgres://postgres:postgres@localhost:5432/openminion
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret

# Optional (for specific features)
OPENAI_API_KEY=sk-...        # For LLM features
TELEGRAM_BOT_TOKEN=...       # For Telegram testing
```

### Running the Dev Server

```bash
# Start with hot reload
bun run dev

# The API will be available at http://localhost:3000
# Swagger docs at http://localhost:3000/docs
```

### Useful Commands

```bash
bun run dev              # Development server
bun run test             # Run tests
bun run test:unit        # Unit tests only
bun run typecheck        # TypeScript validation
bun run check            # Lint + format check
bun run check:fix        # Auto-fix issues
bun run db:studio        # Visual database browser
```

---

## Project Structure

```
openminion/
├── src/
│   ├── features/           # Feature modules (domain-driven)
│   │   ├── auth/          # Authentication & authorization
│   │   ├── teams/         # Team management
│   │   ├── tasks/         # Task management
│   │   ├── conversations/ # LLM conversations
│   │   ├── memory/        # Project memory/RAG
│   │   ├── telegram/      # Telegram integration
│   │   ├── whatsapp/      # WhatsApp integration
│   │   └── ...
│   ├── shared/            # Shared utilities
│   │   ├── db/           # Database schema & migrations
│   │   ├── lib/          # Utility functions
│   │   ├── middleware/   # Global middleware
│   │   └── types/        # Shared types
│   └── index.ts          # Application entry
├── tests/                 # Test utilities
├── drizzle/              # Migration files
└── docs/                 # Documentation
```

### Feature Module Structure

Each feature follows this pattern:

```
features/example/
├── __tests__/
│   ├── example.test.ts           # Unit tests
│   └── example.integration.test.ts # Integration tests
├── example.routes.ts      # API routes
├── example.service.ts     # Business logic
├── example.types.ts       # TypeScript types
└── index.ts              # Public exports
```

---

## How to Contribute

### Reporting Bugs

Found a bug? Please [open an issue](https://github.com/openminion/openminion/issues/new) with:

- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Bun version, etc.)
- Screenshots if applicable

### Suggesting Features

Have an idea? [Open a feature request](https://github.com/openminion/openminion/issues/new) with:

- Problem you're trying to solve
- Proposed solution
- Alternatives you've considered
- How it fits with OpenCaptain's philosophy

### Contributing Code

1. **Find an issue** - Look for issues labeled `good first issue` or `help wanted`
2. **Comment on it** - Let us know you're working on it
3. **Create a branch** - See naming convention below
4. **Write code** - Follow our coding standards
5. **Write tests** - Maintain or improve coverage
6. **Submit PR** - Follow the PR template

### Areas We Need Help

- **Integrations**: Slack, Discord, Notion, GitHub issues
- **UI Components**: React components for the web dashboard
- **Documentation**: Tutorials, guides, API examples
- **Translations**: i18n support for global teams
- **Testing**: Improve test coverage and E2E tests
- **Performance**: Optimization and benchmarking

---

## Pull Request Process

### Branch Naming

```
feature/description    # New features
fix/description        # Bug fixes
docs/description       # Documentation
refactor/description   # Code refactoring
test/description       # Test improvements
```

Examples:
- `feature/slack-integration`
- `fix/auth-token-expiry`
- `docs/api-examples`

### Before Submitting

- [ ] Tests pass: `bun run test`
- [ ] Types check: `bun run typecheck`
- [ ] Lint passes: `bun run check`
- [ ] Code is formatted: `bun run format`
- [ ] Commit messages follow convention
- [ ] PR description is complete

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## How Has This Been Tested?
Describe tests you ran

## Checklist
- [ ] My code follows the project style
- [ ] I have added tests
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
```

### Review Process

1. A maintainer will review within 48 hours
2. Address any requested changes
3. Once approved, a maintainer will merge
4. Your contribution will be in the next release!

---

## Coding Standards

### TypeScript

```typescript
// Use explicit types for function parameters and returns
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Use type exports
export type { User, Team, Task };

// Prefer interfaces for objects
interface TaskInput {
  title: string;
  assigneeId?: string;
  dueDate?: Date;
}

// Use const assertions for literals
const STATUS = {
  PENDING: 'pending',
  DONE: 'done',
} as const;
```

### Code Style

- Use Biome for linting and formatting
- Prefer early returns over nested conditionals
- Keep functions small and focused
- Use descriptive variable names
- Add comments for non-obvious logic only

```typescript
// Good: Early return
function getUser(id: string) {
  const user = users.get(id);
  if (!user) {
    return null;
  }
  return user;
}

// Avoid: Deep nesting
function getUser(id: string) {
  const user = users.get(id);
  if (user) {
    return user;
  } else {
    return null;
  }
}
```

### Error Handling

Use the RFC 7807 Problem Details format:

```typescript
import { createError } from '../shared/lib/errors';

throw createError({
  type: 'validation-error',
  title: 'Validation Failed',
  status: 400,
  detail: 'Email is required',
});
```

### Async/Await

Always use async/await over raw promises:

```typescript
// Good
async function fetchTasks() {
  const tasks = await db.query.tasks.findMany();
  return tasks;
}

// Avoid
function fetchTasks() {
  return db.query.tasks.findMany().then(tasks => tasks);
}
```

---

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('TaskService', () => {
  describe('createTask', () => {
    it('should create a task with valid input', async () => {
      // Arrange
      const input = { title: 'Test task' };

      // Act
      const result = await taskService.createTask(input);

      // Assert
      expect(result.title).toBe('Test task');
    });

    it('should throw error for invalid input', async () => {
      const input = { title: '' };

      await expect(taskService.createTask(input))
        .rejects.toThrow('Title is required');
    });
  });
});
```

### Test Types

| Type | File Pattern | Purpose |
|------|--------------|---------|
| Unit | `*.test.ts` | Test isolated functions |
| Integration | `*.integration.test.ts` | Test with real DB/Redis |

### Running Tests

```bash
# All tests
bun run test

# Specific file
bun test src/features/tasks/__tests__/tasks.service.test.ts

# With coverage
bun run test:coverage

# Watch mode
bun test --watch
```

### Test Database

Integration tests use a real PostgreSQL database. The test setup handles:
- Creating test database
- Running migrations
- Cleaning up between tests

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no new feature or fix |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(tasks): add subtask support

fix(auth): handle expired refresh tokens

docs(readme): add deployment instructions

refactor(teams): extract visibility logic to service

test(conversations): add integration tests for memory
```

### Commit Message Tips

- Use imperative mood: "add feature" not "added feature"
- Keep first line under 72 characters
- Reference issues: "fix(auth): handle timeout (#123)"
- Explain "why" in body if not obvious

---

## Need Help?

### Resources

- [Project Documentation](docs/)
- [API Reference](http://localhost:3000/docs) (when running locally)

### Getting Help

- **Questions**: Open a [Discussion](https://github.com/openminion/openminion/discussions)
- **Bugs**: Open an [Issue](https://github.com/openminion/openminion/issues)

### Maintainers

- Feel free to tag maintainers in PRs for review
- We aim to respond within 48 hours

---

## Recognition

Contributors are recognized in:
- Our [Contributors](https://github.com/openminion/openminion/graphs/contributors) page
- Release notes for significant contributions
- The project README for major features

---

Thank you for contributing to OpenCaptain! Every contribution, no matter how small, helps make project management more accessible and human-centered.
