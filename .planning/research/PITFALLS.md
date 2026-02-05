# BlockBot: Common Pitfalls and Critical Mistakes to Avoid

> Research compiled from post-mortems, industry reports, and expert discussions on AI agent platforms, messaging integrations, and open source project management.

---

## Table of Contents

1. [Technical Pitfalls](#1-technical-pitfalls)
2. [Product Pitfalls](#2-product-pitfalls)
3. [WhatsApp/Telegram API Gotchas](#3-whatsapptelegram-api-gotchas)
4. [LLM Agent Pitfalls](#4-llm-agent-pitfalls)
5. [Open Source Project Pitfalls](#5-open-source-project-pitfalls)
6. [Summary: Top 10 Critical Mistakes](#6-summary-top-10-critical-mistakes)

---

## 1. Technical Pitfalls

### 1.1 Architecture Mistakes

#### Polling Instead of Event-Driven Architecture

**The Mistake:** Building the system on request-response polling infrastructure instead of webhooks or event-driven systems.

**Why It Fails:** Polling wastes 95% of API calls, burns through rate limit quotas, and never achieves real-time responsiveness. You cannot build autonomous agents on polling infrastructure.

**Warning Signs:**
- Constantly hitting rate limits on external APIs
- High API costs with minimal actual data changes
- Noticeable lag between user actions and system responses
- Linear API explicitly discourages polling; violating this may get you rate-limited

**Prevention:**
- Use webhooks for all integrations (Linear, WhatsApp, Telegram)
- Implement proper event queuing (Redis, RabbitMQ)
- Design for push-based updates from the start

**Sources:** [Composio AI Agent Report](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap), [Linear Developer Docs](https://linear.app/developers/rate-limiting)

---

#### Building a Monolithic "God Agent"

**The Mistake:** Creating a single agent that tries to handle all tasks (PM, coding, communication, research) in one context.

**Why It Fails:** Dilutes the model's attention, leading to confusion and hallucinations. The agent becomes jack-of-all-trades, master of none.

**Warning Signs:**
- Increasing hallucination rates as features are added
- Agent "forgetting" earlier context in conversations
- Degraded performance on tasks that previously worked well
- Prompts becoming unwieldy (thousands of tokens of instructions)

**Prevention:**
- Use specialized multi-agent systems with clear responsibilities
- Implement an orchestrator pattern that routes to specialized sub-agents
- Keep each agent's scope narrow and well-defined
- Note: Subagents should not spawn other subagents (prevents infinite nesting)

**Sources:** [Edstellar AI Agent Reliability](https://www.edstellar.com/blog/ai-agent-reliability-challenges), [Claude Code Multi-Agent](https://paddo.dev/blog/claude-code-hidden-swarm/)

---

#### Vector Database as Universal Memory

**The Mistake:** Dumping all project data into a vector database without structure, schemas, or decay mechanisms.

**Why It Fails:** Leads to "context-flooding" where the LLM drowns in irrelevant, unstructured information. Embeddings are static snapshots that don't evolve unless explicitly updated.

**Warning Signs:**
- RAG retrievals returning irrelevant or outdated information
- Memory bloat causing slow retrieval times
- Agent responses citing obsolete project states
- "Frozen" memories that don't reflect user corrections

**Prevention:**
- Implement proper schemas and metadata for all stored memories
- Add memory decay mechanisms for outdated information
- Separate semantic memory (facts) from episodic memory (interactions)
- Actively manage vectors: remove or replace when information changes
- Don't treat memory as unstructured text

**Sources:** [DEV - Memory Is Not a Vector Database](https://dev.to/harshitk/memory-is-not-a-vector-database-why-ai-agents-need-beliefs-not-storage-2baj), [IBM AI Agent Memory](https://www.ibm.com/think/topics/ai-agent-memory)

---

### 1.2 Scaling Pitfalls

#### Underestimating Self-Hosted Infrastructure Requirements

**The Mistake:** Assuming 2GB RAM and 2 CPU cores (dev specs) will work for production.

**Why It Fails:** Production workflows require significantly more resources. Misjudging leads to performance bottlenecks, downtime, and unexpected costs.

**Warning Signs:**
- Workflow execution slowing down under load
- OOM (Out of Memory) errors
- Database connection pool exhaustion
- Users reporting intermittent failures

**Prevention:**
- Plan for at least 8GB RAM, 4 CPU cores for production
- Use PostgreSQL (not SQLite) for database reliability
- Implement queue mode with workers for horizontal scaling
- Budget $300-500/month minimum for self-hosted production infrastructure
- Expect 10-20 hours/month DevOps overhead

**Sources:** [Latenode n8n System Requirements](https://latenode.com/blog/low-code-no-code-platforms/n8n-setup-workflows-self-hosting-templates/n8n-system-requirements-2025-complete-hardware-specs-real-world-resource-analysis), [DEV - Real Limits of n8n](https://dev.to/alifar/the-real-limits-of-n8n-free-automation-what-you-need-to-know-before-shipping-to-production-59o6)

---

#### Single-Process Event Loop Blocking

**The Mistake:** Running all workflows in a single process without concurrency controls.

**Why It Fails:** One badly written workflow blocks the event loop, causing all other workflows to pause. Too many concurrent executions can thrash the event loop.

**Warning Signs:**
- System becomes unresponsive during heavy operations
- Timeouts on simple operations
- Workflows "hanging" for no apparent reason
- CPU at 100% but memory usage normal

**Prevention:**
- Implement concurrency control limits
- Use queue mode with separate worker processes
- Add timeouts to all external API calls
- Monitor event loop lag as a key metric

**Sources:** [n8n Concurrency Control Docs](https://docs.n8n.io/hosting/scaling/concurrency-control/)

---

### 1.3 Reliability Pitfalls

#### Missing Retry Logic and Error Handling

**The Mistake:** Assuming API calls will succeed and not implementing retry mechanisms.

**Why It Fails:** Rate limiting, network issues, and transient failures are inevitable. Without retry logic, workflows fail completely on minor hiccups.

**Warning Signs:**
- Frequent workflow failures with "connection reset" or "timeout" errors
- Users reporting random failures that work on retry
- High failure rates during peak hours
- Incomplete operations (half-executed workflows)

**Prevention:**
- Implement exponential backoff for all external API calls
- Add circuit breakers for failing services
- Design workflows to be idempotent (safe to retry)
- Log all failures with enough context to debug
- Handle 429 (rate limit) errors by waiting the specified retry_after time

**Sources:** [grammY Flood Limits Guide](https://grammy.dev/advanced/flood)

---

#### Not Treating AI Agents as High-Risk Identities

**The Mistake:** Treating coding agents and LLM agents as harmless chatbots rather than powerful engineer accounts.

**Why It Fails:** The biggest AI failures of 2025 weren't technical - they were organizational: weak controls, unclear ownership, and misplaced trust.

**Warning Signs:**
- Agents with full admin access to production systems
- No logging of agent actions
- No rate limits on agent operations
- Agents able to execute arbitrary code without sandboxing

**Prevention:**
- Apply least-privilege access principles
- Implement rate limits on agent actions
- Log and monitor all agent operations
- Use sandboxing for code execution (gVisor, Firecracker)
- Review agent actions periodically

**Sources:** [ISACA - Avoiding AI Pitfalls](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents), [Google Cloud - Lessons on Agents and Trust](https://cloud.google.com/transform/ai-grew-up-and-got-a-job-lessons-from-2025-on-agents-and-trust)

---

## 2. Product Pitfalls

### 2.1 UX Mistakes

#### Lack of Transparency in Agent Actions

**The Mistake:** AI agents that act as black boxes without explaining their decisions or showing their work.

**Why It Fails:** "Trust is the true obstacle, not talent or software. When AI is unable to explain its decisions or comprehend corporate culture, teams are reluctant to rely on it."

**Warning Signs:**
- Users asking "why did it do that?"
- Low adoption despite good functionality
- Users manually verifying all agent outputs
- Requests to disable autonomous features

**Prevention:**
- Show agent reasoning and decision chains
- Provide audit logs of all actions taken
- Allow users to preview actions before execution
- Implement "explain this decision" functionality
- Enterprises cannot scale agents without trust; trust comes from visibility

**Sources:** [Digital Project Manager - AI Adoption](https://thedigitalprojectmanager.com/project-management/ai-adoption-in-project-management/), [Aubergine - Building Trust in AI Agents](https://www.aubergine.co/insights/building-trust-in-ai-agents)

---

#### No Clear Use Cases Defined

**The Mistake:** Rushing to ship features without defining specific, business-focused use cases.

**Why It Fails:** "Teams rush to adopt AI at scale without clear, business-specific use cases." Users don't know how to use the tool effectively.

**Warning Signs:**
- High signup rates but low retention
- Support tickets asking "what can this do?"
- Users only using basic features
- Feature requests for things already built

**Prevention:**
- Define 3-5 core use cases before building
- Create guided onboarding for each use case
- Provide templates for common workflows
- Measure success against specific business outcomes

**Sources:** [Digital Project Manager - AI Adoption](https://thedigitalprojectmanager.com/project-management/ai-adoption-in-project-management/)

---

#### Treating Agent as Drop-in Replacement

**The Mistake:** Positioning the AI agent as a direct replacement for existing workflows rather than a new tool requiring adaptation.

**Why It Fails:** Stalled pilot projects treated agents as drop-in replacements rather than as new architectural components. Agentic systems need ongoing training, boundary setting, and continuous refinement - not "deploy and forget."

**Warning Signs:**
- Users comparing agent negatively to manual process
- Frustration that agent "doesn't work like [existing tool]"
- Attempts to force agent into existing workflow patterns
- Resistance from users comfortable with current methods

**Prevention:**
- Position as augmentation, not replacement
- Design new workflows that leverage agent capabilities
- Provide migration paths, not forced switches
- Educate users on agent-first thinking

**Sources:** [Directual - Why 95% of AI Projects Fail](https://www.directual.com/blog/ai-agents-in-2025-why-95-of-corporate-projects-fail), [Beam.ai - Agentic AI](https://beam.ai/agentic-insights/agentic-ai-in-2025-why-90-of-implementations-fail-(and-how-to-be-the-10-))

---

### 2.2 Trust and Adoption Barriers

#### Data Privacy Concerns

**The Mistake:** Not addressing data sensitivity concerns upfront, especially for self-hosted solutions.

**Why It Fails:** "Data sensitivity prevents adoption altogether. Many organizations handle confidential client or proprietary data, and feeding that information into third-party AI tools can introduce serious risks."

**Warning Signs:**
- Enterprise prospects asking extensive security questions
- Users avoiding putting sensitive data in the system
- Legal/compliance blocking adoption
- Workarounds where users maintain separate "safe" systems

**Prevention:**
- Emphasize self-hosted nature for data control
- Provide clear data flow documentation
- Implement data isolation between projects
- Support local/on-premise LLM options
- Get SOC2 or similar compliance if targeting enterprises

**Sources:** [Digital Project Manager - AI Adoption](https://thedigitalprojectmanager.com/project-management/ai-adoption-in-project-management/)

---

#### Fear of Job Displacement

**The Mistake:** Not addressing the elephant in the room - that PM agents might replace PMs.

**Why It Fails:** "Employees often fear AI will eliminate their jobs, leading to resistance and reduced cooperation."

**Warning Signs:**
- Passive resistance from potential users
- Sabotage or working around the system
- Managers not championing adoption
- "We tried it but it didn't work for us"

**Prevention:**
- Frame as "PM copilot" not "PM replacement"
- Show how it handles tedious tasks, freeing time for strategy
- Provide clear messaging about human-in-the-loop design
- Create psychological safety for experimentation
- Celebrate successful human-agent collaboration stories

**Sources:** [Digital Project Manager - AI Adoption](https://thedigitalprojectmanager.com/project-management/ai-adoption-in-project-management/), [WEF - Overcoming AI Adoption Obstacles](https://www.weforum.org/stories/2025/12/3-obstacles-to-ai-adoption-and-innovation-and-how-to-overcome-them/)

---

## 3. WhatsApp/Telegram API Gotchas

### 3.1 WhatsApp Business API

#### Message Template Approval Process

**The Pitfall:** Underestimating the time and complexity of WhatsApp template approval.

**Details:**
- Templates can take days to weeks for approval
- Meta rejects templates that lack clarity or are overly promotional
- Display name approval has no fixed timeline
- Business verification is required for higher limits and often becomes the biggest bottleneck

**Warning Signs:**
- Launch delays due to template rejections
- Features blocked waiting for approvals
- Users unable to use key functionality

**Prevention:**
- Start template approval process early (weeks before launch)
- Keep templates clear, non-promotional, and aligned with guidelines
- Complete business verification immediately
- Have backup templates ready
- Understand that utility templates must be non-promotional and transaction-related

**Sources:** [WATI - WhatsApp API Rate Limits](https://www.wati.io/en/blog/whatsapp-business-api/whatsapp-api-rate-limits/), [eesel.ai - WhatsApp API Policy Changes](https://www.eesel.ai/blog/whatsapp-business-api-latest-pricing-and-policy-changes)

---

#### Conversation-Based Rate Limits

**The Pitfall:** Not understanding WhatsApp's conversation-based (not message-based) rate limiting.

**Details:**
- Limits are per business portfolio, not per number
- New accounts: 250 conversations/24 hours
- Can increase to 2,000 -> 10,000 -> 100,000 -> unlimited based on quality
- Maximum 80 messages per second per phone number (Cloud API)
- Only 1 message every 6 seconds to a specific user number

**Warning Signs:**
- Message delivery failures during campaigns
- Account restrictions or temporary bans
- Users not receiving expected messages

**Prevention:**
- Start small and build up quality score
- Monitor quality metrics in WhatsApp Business Manager
- Implement queuing to stay within per-second limits
- Never spam users - it permanently damages your quality score
- Plan for the 24-hour rolling window

**Sources:** [Chat Architect - WhatsApp Rate Limits](https://www.chatarchitect.com/news/whatsapp-api-rate-limits-what-you-need-to-know-before-you-scale), [Fyno - WhatsApp Rate Limits](https://www.fyno.io/blog/whatsapp-rate-limits-for-developers-a-guide-to-smooth-sailing-clycvmek2006zuj1oof8uiktv)

---

#### Policy Changes and Category Enforcement

**The Pitfall:** Using utility templates for marketing content.

**Details:**
- As of April 16, 2025: No 24-hour warning before utility templates are reclassified to marketing
- Template review requests disabled for 7 days after violations
- Meta is getting much stricter about template category enforcement
- Misclassified templates can result in immediate consequences

**Prevention:**
- Strictly separate marketing and utility templates
- Utility = specific transaction/account updates the user initiated
- Review all templates against current Meta guidelines
- Plan for pricing differences between categories

**Sources:** [eesel.ai - WhatsApp API Policy Changes](https://www.eesel.ai/blog/whatsapp-business-api-latest-pricing-and-policy-changes)

---

### 3.2 Telegram Bot API

#### Flexible Rate Limits

**The Pitfall:** Assuming Telegram has simple, documented rate limits.

**Details:**
- Limits are NOT hard thresholds you can find by experimenting
- They change based on bot's request payloads, user count, and other factors
- In single chat: max 1 message per second
- In groups: max 20 messages per minute
- Broadcast: max 30 users per second (default), up to 1000 with Paid Broadcasts

**Warning Signs:**
- 429 errors appearing unpredictably
- Limits changing without code changes
- Different behavior in testing vs production

**Prevention:**
- Implement conservative rate limiting (well under theoretical limits)
- Use different queues for individual chats vs groups
- Enable Paid Broadcasts in @BotFather if needed
- Never rely on tested limits - always assume they could be lower

**Sources:** [Telegram Bots FAQ](https://core.telegram.org/bots/faq), [grammY - Flood Limits](https://grammy.dev/advanced/flood)

---

#### Proper Error Handling for 429 Errors

**The Pitfall:** Ignoring or improperly handling rate limit errors.

**Details:**
- 429 errors include a retry_after header
- "There is only one correct way to handle these situations: Wait for the specified number of seconds. Retry the request."
- Trying to retry immediately will make things worse

**Prevention:**
- Always respect retry_after values
- Implement exponential backoff
- Queue messages during rate limit periods
- Don't retry immediately - you'll get blocked longer

**Sources:** [grammY - Flood Limits](https://grammy.dev/advanced/flood), [GramIO - Rate Limits](https://gramio.dev/rate-limits)

---

#### Broadcasting Strategy

**The Pitfall:** Sending mass notifications too quickly.

**Details:**
- Default limit: ~30 messages/second
- Going over triggers 429 errors
- During high-activity periods, even normal operations can hit limits

**Prevention:**
- Spread notifications over 8-12 hours for large broadcasts
- Implement intelligent queuing that adjusts to current limits
- Consider enabling Paid Broadcasts (1000 msg/sec) for large user bases
- Monitor broadcast success rates and adjust timing

**Sources:** [BytePlus - Telegram Rate Limits](https://www.byteplus.com/en/topic/450600)

---

## 4. LLM Agent Pitfalls

### 4.1 Hallucination

#### Why Hallucination Is Critical for Agents

**The Pitfall:** Treating agent hallucinations like chatbot hallucinations (annoying but harmless).

**Why It's Worse:** "For AI agents, which are often designed to take action based on information, hallucinations are particularly dangerous." Hallucinations erode user trust, create compliance risks, and can cause direct financial damage.

**Warning Signs:**
- Agent creating Linear issues that reference non-existent features
- Claiming to have completed tasks it didn't
- Referencing files or code that doesn't exist
- Inventing meeting summaries or decisions

**Prevention:**
- Implement RAG to ground responses in real project data
- Require verification before destructive actions
- Add fact-checking layers for critical operations
- Never let agent act on hallucinated information

**Sources:** [Getmaxim - Why AI Agents Fail in Production](https://www.getmaxim.ai/articles/top-6-reasons-why-ai-agents-fail-in-production-and-how-to-fix-them/), [Noveum - Why AI Agents Hallucinate](https://noveum.ai/en/blog/why-your-ai-agents-are-hallucinating-and-how-to-stop-it)

---

#### Context Window Overload

**The Pitfall:** Assuming larger context windows solve hallucination problems.

**Why It Fails:** "While scaling context improves potential input scope, it also magnifies architectural weaknesses and cognitive overload in autoregressive models." Enlarging context can introduce irrelevant or noisy details that encourage hallucination.

**Warning Signs:**
- Performance degrading as project knowledge grows
- More hallucinations despite more context
- Agent getting "confused" in long conversations
- Relevant information being ignored

**Prevention:**
- Quality over quantity in context
- Use intelligent retrieval, not "dump everything"
- Implement context summarization for long histories
- Keep active context focused on current task

**Sources:** [Medium - Why LLMs Hallucinate in Long Contexts](https://medium.com/design-bootcamp/when-more-becomes-less-why-llms-hallucinate-in-long-contexts-fc903be6f025), [Deepchecks - Context Errors](https://www.deepchecks.com/context-errors-cause-llm-hallucinations/)

---

### 4.2 Cost Management

#### Output Tokens Cost More

**The Pitfall:** Budgeting based on input token prices.

**Details:** "Output tokens cost 3-10x more than input tokens. For a typical chatbot that generates 2x more output than input, the real cost is 9x higher than the advertised input-only price."

**Warning Signs:**
- Actual costs far exceeding projections
- Verbose agent responses eating budget
- Cost unpredictability month-to-month
- Users avoiding the tool to save costs

**Prevention:**
- Budget based on output tokens, not input
- Set max_tokens limits to prevent runaway responses
- Use batch API (50% discount) where 24-hour turnaround is acceptable
- Implement prompt caching (90% discount on cache hits)
- Monitor actual token usage, not just API calls

**Sources:** [Cloudidr - LLM Pricing Comparison](https://www.cloudidr.com/blog/llm-pricing-comparison-2026), [Binadox - LLM API Pricing](https://www.binadox.com/blog/llm-api-pricing-comparison-2025-complete-cost-analysis-guide/)

---

#### Wrong Model for Wrong Task

**The Pitfall:** Using the most powerful (expensive) model for everything.

**Details:** "Using a cheaper model for 70% of routine tasks while reserving expensive models for 30% yields better ROI than all-in on the top model."

**Prevention:**
- Route simple queries to cheaper models
- Reserve premium models for complex reasoning
- Implement model selection logic based on task type
- A/B test model performance vs cost for each use case
- Consider that optimization strategies can reduce costs 50-90%

**Sources:** [IntuitionLabs - LLM API Pricing](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)

---

### 4.3 Agent Architecture

#### No Learning or Memory Accumulation

**The Pitfall:** Treating every query as if it's the first one.

**Why It Fails:** "Most corporate GenAI systems don't retain feedback, don't accumulate knowledge, and don't improve over time."

**Warning Signs:**
- Users repeating the same corrections
- Agent making the same mistakes repeatedly
- No improvement in quality over time
- Users frustrated by "starting over" every conversation

**Prevention:**
- Implement feedback loops that persist
- Store successful interaction patterns
- Track common corrections and pre-apply them
- Build project-specific knowledge bases that evolve

**Sources:** [Directual - Why AI Projects Fail](https://www.directual.com/blog/ai-agents-in-2025-why-95-of-corporate-projects-fail)

---

#### Prompt Injection Vulnerabilities

**The Pitfall:** Not protecting against malicious input that hijacks agent behavior.

**Details:** One of the six primary failure modes in production AI agents. Particularly dangerous when agents have access to external tools and systems.

**Prevention:**
- Sanitize and validate all user inputs
- Implement input/output guardrails
- Use separate contexts for user input vs system prompts
- Monitor for anomalous agent behavior
- Never let user input directly modify system prompts

**Sources:** [Getmaxim - Why AI Agents Fail](https://www.getmaxim.ai/articles/top-6-reasons-why-ai-agents-fail-in-production-and-how-to-fix-them/)

---

### 4.4 Multi-Agent and Coding Agent Pitfalls

#### Uncontrolled Multi-Agent Spawning

**The Pitfall:** Allowing agents to spawn unlimited sub-agents or parallel instances.

**Why It Fails:** "Multi-agent systems mean multiplied API calls." Running tasks in parallel "can eat up usage quickly, as it uses a lot of tokens." Multiple agents can lead to chaos if done incorrectly.

**Warning Signs:**
- Unexpected cost spikes
- System resource exhaustion
- Conflicting actions from different agents
- Circular agent invocations

**Prevention:**
- Subagents should not spawn other subagents (prevents infinite nesting)
- Set hard limits on concurrent agent instances
- Implement cost budgets per operation
- Monitor agent spawning patterns
- Design clear agent hierarchies and communication protocols

**Sources:** [DEV - Multi-Agent Orchestration](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da), [Claude Code Multi-Agent](https://paddo.dev/blog/claude-code-hidden-swarm/)

---

#### Code Execution Without Sandboxing

**The Pitfall:** Running coding agent output directly on production systems.

**Details:** Security researchers cite incidents including "langflow RCE discovered by Horizon3, a vulnerability in Cursor allowing RCE through auto-execution, and a database wipe-out affecting Replit."

**Prevention:**
- Always sandbox code execution
- Use gVisor, Firecracker, or purpose-built platforms
- Implement permission boundaries
- Review agent-generated code before execution in sensitive environments
- Never give coding agents production database access

**Sources:** [InfoQ - Agent Sandbox Kubernetes](https://www.infoq.com/news/2025/12/agent-sandbox-kubernetes/), [Northflank - Code Execution Sandbox](https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents)

---

## 5. Open Source Project Pitfalls

### 5.1 Maintainer Burnout

#### The Solo Maintainer Trap

**The Pitfall:** Building critical infrastructure maintained by one or two people.

**Why It Fails:** "60% of maintainers are not paid for their work." "Popular package maintainers drown in requests and are often solo, with finding quality contributors nearly impossible."

**Warning Signs:**
- Single point of failure for all decisions
- Delayed responses to issues/PRs
- Decreasing commit frequency
- Maintainer expressing frustration publicly

**Prevention:**
- Build a core team with clear responsibilities from the start
- Implement rotating leadership roles
- Establish firm boundaries on response times
- Document everything so others can contribute
- Consider funding models early

**Sources:** [Medium - Open Source Burnout Crisis](https://medium.com/@sohail_saifii/the-open-source-maintainer-burnout-crisis-nobodys-fixing-5cf4b459a72b), [Open Source Guides - Maintaining Balance](https://opensource.guide/maintaining-balance-for-open-source-maintainers/)

---

#### Toxic Community Interactions

**The Pitfall:** Not establishing boundaries with entitled or toxic users.

**Why It Fails:** "As a project's popularity increases, the frequency of interactions with ungrateful, entitled or outright toxic people increases, becoming a significant risk factor for burnout."

**Prevention:**
- Establish and enforce a code of conduct
- Set clear expectations in CONTRIBUTING.md
- Use issue templates to guide constructive feedback
- Don't hesitate to block toxic individuals
- Build support networks with other maintainers

**Sources:** [Jeff Geerling - Burden of Open Source Maintainer](https://www.jeffgeerling.com/blog/2022/burden-open-source-maintainer), [CMU - Stress and Burnout in Open Source](https://www.cs.cmu.edu/~ckaestne/pdf/icsenier20.pdf)

---

### 5.2 Documentation Failures

#### Not Writing Things Down

**The Pitfall:** Keeping knowledge in maintainers' heads instead of documentation.

**Why It Fails:** "Writing things down is one of the most important things maintainers can do, as documentation clarifies thinking and helps people understand what you need or expect before they ask."

**Warning Signs:**
- Same questions asked repeatedly
- Contributors unable to onboard without maintainer help
- PRs that miss project conventions
- Forks diverging due to misunderstanding

**Prevention:**
- Document decisions and their rationale (ADRs)
- Write comprehensive CONTRIBUTING.md
- Keep README focused and current
- Create architecture documentation for contributors
- Document the "why" not just the "how"

**Sources:** [Open Source Guides - Best Practices](https://opensource.guide/best-practices/)

---

### 5.3 Community Building Mistakes

#### Code Over Community

**The Pitfall:** Focusing only on code and ignoring community building.

**Why It Fails:** "Maintaining a project is about building a community, not just managing code. People stay when they feel included and respected and contribute more when their opinions are heard."

**Warning Signs:**
- Few repeat contributors
- Issues go unanswered
- No community discussions
- Contributors leave after one PR

**Prevention:**
- Respond to issues and PRs promptly (even if just to acknowledge)
- Celebrate contributions publicly
- Create spaces for community discussion (Discord, GitHub Discussions)
- Involve community in roadmap decisions
- Host community events or calls

**Sources:** [Open Source Guides - Best Practices](https://opensource.guide/best-practices/), [Open Source Pledge - Burnout Structural Problem](https://opensourcepledge.com/blog/burnout-in-open-source-a-structural-problem-we-can-fix-together/)

---

### 5.4 Integration-Specific Pitfalls

#### Linear API Best Practices

**Pitfalls to Avoid:**
- Polling for updates (use webhooks instead)
- Ignoring query complexity limits (0.1 points/property, 1 point/object, connections multiply)
- Not responding quickly to webhooks (respond fast, process asynchronously)
- Subscribing to all webhook events (only subscribe to what you need)

**Prevention:**
- Implement async webhook processing
- Calculate query complexity before execution
- Handle webhook duplicates gracefully
- Re-enable disabled webhook endpoints promptly

**Sources:** [Linear Developer Docs](https://linear.app/developers/rate-limiting), [Linear Webhooks Guide](https://inventivehq.com/blog/linear-webhooks-guide)

---

## 6. Summary: Top 10 Critical Mistakes

| # | Mistake | Impact | Prevention |
|---|---------|--------|------------|
| 1 | Building monolithic "God Agent" | Hallucinations, confusion | Use specialized multi-agent architecture |
| 2 | Polling instead of webhooks | Rate limits, poor UX | Event-driven design from start |
| 3 | No sandbox for code execution | Security breaches | Always isolate agent code execution |
| 4 | Underestimating infrastructure | Downtime, cost overruns | Plan 8GB RAM, 4 CPU, $300+/month |
| 5 | Dumping everything in vector DB | Context flooding | Structured schemas, memory decay |
| 6 | Ignoring output token costs | 9x budget overrun | Budget for output, set max_tokens |
| 7 | Solo maintainer model | Burnout, project death | Build core team early |
| 8 | No agent action transparency | User distrust | Show reasoning, provide audit logs |
| 9 | WhatsApp template approval delays | Launch delays | Start approval process weeks early |
| 10 | No retry logic for external APIs | Cascading failures | Exponential backoff everywhere |

---

## Additional Resources

### Industry Reports
- [Composio - Why AI Agent Pilots Fail](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap)
- [Cleanlab - AI Agents in Production 2025](https://cleanlab.ai/ai-agents-in-production-2025/)
- [McKinsey - Seizing the Agentic AI Advantage](https://www.mckinsey.com/capabilities/quantumblack/our-insights/seizing-the-agentic-ai-advantage)

### Technical Guides
- [n8n Self-Hosting Documentation](https://docs.n8n.io/hosting/)
- [Linear Developer Portal](https://linear.app/developers)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

### Open Source Sustainability
- [Open Source Guides](https://opensource.guide/)
- [Open Source Pledge](https://opensourcepledge.com/)

---

*Last updated: February 2026*
*Research compiled for BlockBot project planning*
