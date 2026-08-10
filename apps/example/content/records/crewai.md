---
title: "CrewAI — Coordinating Role-Playing AI Agents in Python"
summary: "A Python framework for orchestrating role-playing autonomous agents, tasks, multi-step crews, and Flows with memory, tools, and human-in-the-loop guardrails."
tags: [agents, multi-agent, orchestration, python, llm, automation]
updated: 2026-08-10
---

CrewAI is a lean, fast Python framework for orchestrating **role-playing autonomous agents** that collaborate on a sequence of tasks. You define an `Agent` with a role, a goal, and a backstory; give it tools; bind it to one or more `Task`s; declare a `Crew` with a process; and call `.kickoff()`. The framework handles the message-passing loop, tool calling, memory, delegation, and checkpointing — all driven by [LiteLLM](https://github.com/BerriAI/litellm), so the same code can target GPT-4o, Claude 4.6, Llama 4, or a local Ollama model without changes.

> "Frameworks like LangChain and AutoGen made it easy to build single-agent loops. CrewAI made it easy to build *teams* that pass work between each other."
> — Joao (Joe) Moura, founder of CrewAI, interview on Latent Space, 2025

The project is published under the **MIT License** and ships with `crewai`, `crewai-tools`, a CLI (`crewai run`), and a streaming `crewai chat` REPL. It is actively maintained by the [crewAIInc](https://github.com/crewAIInc) organization on GitHub and powers production workloads across finance, research, and developer tooling.

## What it solves

Most LLM frameworks optimize for *one model + one prompt + one tool call*. CrewAI optimizes for the next step up: a **team** of agents with different roles, a shared plan, and explicit handoffs.

- **Multi-agent patterns as code.** A crew of `Researcher → Writer → Editor` is a five-line `Crew(...)` constructor. Tools are typed Python callables; delegation between agents is built in.
- **Model-agnostic by default.** CrewAI runs on LiteLLM, so the same code can switch between `openai/gpt-4o`, `anthropic/claude-sonnet-4-6`, `groq/llama-3.3-70b`, or a local Ollama endpoint.
- **Two execution modes.** `Process.sequential` (the canonical "research → write → review" pipeline) and `Process.hierarchical` (a manager agent picks the next worker). The manager pattern is what the "auto" mode uses.
- **Plays well with the rest of the Python LLM stack.** Tools, memory, and agent definitions are plain Python — drop into a FastAPI service, a notebook, or a scheduled job.

## At a glance

| Attribute | Value |
| :--- | :--- |
| **Repository** | [github.com/crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) |
| **License** | MIT |
| **Language** | Python 3.10+ |
| **Package** | `crewai`, `crewai-tools` |
| **First release** | November 2023 |
| **Latest stable** | 1.6.x (as of mid-2026) |
| **Stars** | 35k+ |
| **Maintainer** | CrewAI Inc. |
| **Docs** | [docs.crewai.com](https://docs.crewai.com) |
| **Discord** | ~22k members |

## Core architecture

### Concepts

CrewAI exposes four core types. The first three are mandatory; the fourth is opt-in but recommended for any non-trivial project.

1. **Agent** — an autonomous unit with a `role`, `goal`, `backstory`, an LLM, and a list of tools.
2. **Task** — a unit of work. A task has a `description`, an `expected_output`, an `agent`, optional `context` (other tasks whose outputs feed in), and optional `tools`.
3. **Crew** — a scheduler. It owns `agents`, `tasks`, a `process` (sequential or hierarchical), a `memory` flag, and a `cache` flag.
4. **Flow** — a higher-level orchestration. A Flow is a stateful, event-driven workflow that triggers Crews as steps, branches on their outputs, and persists state across them.

> A common misconception: a *Flow* is not required to use CrewAI. A Crew can run standalone for prototyping or as a unit of work inside an existing system. **Flows** exist for long-running, stateful applications where you need branching, retries, and persistent state across Crew executions.

### Execution pattern

```text
User input
   │
   ▼
┌─────────────┐
│   Flow      │  ← state, events, branching
└─────┬───────┘
      │  delegates a step
      ▼
┌─────────────┐
│   Crew      │  ← process: sequential | hierarchical
│ ┌─────────┐ │
│ │  Task 1 │ │  ← agent: Researcher
│ ├─────────┤ │
│ │  Task 2 │ │  ← agent: Writer        context=[Task 1]
│ ├─────────┤ │
│ │  Task 3 │ │  ← agent: Editor        context=[Task 2]
│ └─────────┘ │
└─────────────┘
      │
      ▼
CrewOutput (raw, pydantic, tasks_output, token_usage)
```

## Agents

An `Agent` is a single autonomous actor. It carries its own LLM, tools, memory, and prompts. The three string attributes — `role`, `goal`, `backstory` — form the system prompt and are *the* levers you have on agent behavior.

### Full reference

| Attribute | Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| Role | `role` | `str` | _required_ | Agent's function and expertise |
| Goal | `goal` | `str` | _required_ | Individual objective guiding decisions |
| Backstory | `backstory` | `str` | _required_ | Context and personality |
| LLM | `llm` | `Union[str, LLM, Any]` | env or `"gpt-4o-mini"` | Language model powering the agent |
| Tools | `tools` | `List[BaseTool]` | `[]` | Available capabilities |
| Function-calling LLM | `function_calling_llm` | `Optional[Any]` | `None` | LLM used for tool calling (may differ from reasoning LLM) |
| Max iterations | `max_iter` | `int` | `20` | Max iterations before best answer |
| Max RPM | `max_rpm` | `Optional[int]` | `None` | Per-agent rate limit |
| Max execution time | `max_execution_time` | `Optional[int]` | `None` | Timeout in seconds |
| Verbose | `verbose` | `bool` | `False` | Detailed logs |
| Allow delegation | `allow_delegation` | `bool` | `False` | Whether the agent can hand work to other agents |
| Step callback | `step_callback` | `Optional[Any]` | `None` | Per-step callback function |
| Cache | `cache` | `bool` | `True` | Cache tool results across runs |
| Respect context window | `respect_context_window` | `bool` | `True` | Auto-summarize on overflow |
| Multimodal | `multimodal` | `bool` | `False` | Enable image inputs alongside text |
| Inject date | `inject_date` | `bool` | `False` | Auto-inject the current date into the prompt |
| Date format | `date_format` | `str` | `"%Y-%m-%d"` | `strftime` format for the injected date |
| Reasoning | `reasoning` | `bool` | `False` | Pre-task planning step |
| Max reasoning attempts | `max_reasoning_attempts` | `Optional[int]` | `None` | Cap on planning iterations |
| Embedder | `embedder` | `Optional[Dict[str, Any]]` | `None` | Embedding configuration for memory |
| Knowledge sources | `knowledge_sources` | `Optional[List[BaseKnowledgeSource]]` | `None` | Knowledge bases the agent can query |
| Use system prompt | `use_system_prompt` | `Optional[bool]` | `True` | System prompt toggle (set `False` for older models) |
| Max retry limit | `max_retry_limit` | `int` | `2` | Retries on tool errors |

### Defining an agent

The canonical way to define agents today is in a `crew.jsonc` file (or `agents/<name>.jsonc`). JSONC supports comments and trailing commas.

```jsonc
// agents/researcher.jsonc
{
  "role": "{topic} Senior Data Researcher",
  "goal": "Uncover cutting-edge developments in {topic}",
  "backstory": "You find the most relevant information and present it clearly.",
  "llm": "openai/gpt-4o",
  "tools": ["SerperDevTool"],
  "settings": {
    "verbose": true,
    "allow_delegation": false,
    "max_iter": 20,
    "respect_context_window": true
  }
}
```

The same agent in Python:

```python
from crewai import Agent
from crewai_tools import SerperDevTool

researcher = Agent(
    role="Senior Data Researcher",
    goal="Uncover cutting-edge developments in {topic}",
    backstory="You find the most relevant information and present it clearly.",
    llm="openai/gpt-4o",
    tools=[SerperDevTool()],
    verbose=True,
    allow_delegation=False,
    max_iter=20,
    respect_context_window=True,
)
```

Three notes on the Python form:

1. `llm="openai/gpt-4o"` — the **provider prefix is required** for every model. Bare `gpt-4o` will fail.
2. `tools=[SerperDevTool()]` — instantiate, do not pass the class.
3. The `llm=` argument accepts a string or a fully constructed `LLM(...)` object. Use a string for simplicity; use an `LLM(...)` instance when you need provider-specific knobs (timeout, response format, extended thinking, etc.).

### Common patterns

**Basic research agent.**

```python
research_agent = Agent(
    role="Research Analyst",
    goal="Find and summarize information about specific topics",
    backstory="You are an experienced researcher with attention to detail",
    tools=[SerperDevTool()],
    verbose=True,
)
```

**Reasoning agent for complex planning.** The `reasoning=True` flag turns on a pre-task planning step. Use it when the task is open-ended.

```python
strategic_agent = Agent(
    role="Strategic Planner",
    goal="Analyze complex problems and create detailed execution plans",
    backstory="Expert strategic planner who methodically breaks down complex challenges",
    reasoning=True,
    max_reasoning_attempts=3,
    max_iter=30,
    verbose=True,
)
```

**Date-aware agent.** With `inject_date=True`, the agent's system prompt is prefixed with today's date in the chosen format.

```python
market_agent = Agent(
    role="Market Analyst",
    goal="Track market movements with precise date references",
    backstory="Expert in time-sensitive financial analysis and strategic reporting",
    inject_date=True,
    date_format="%B %d, %Y",
    reasoning=True,
    max_reasoning_attempts=2,
)
```

**Multimodal agent.** With `multimodal=True`, the agent accepts image inputs alongside text — useful for vision-language pipelines.

```python
vision_agent = Agent(
    role="Visual Content Analyst",
    goal="Analyze and process both text and visual content",
    backstory="Specialized in multimodal analysis combining text and image understanding",
    multimodal=True,
    verbose=True,
)
```

**Custom prompt templates.** Override `system_template`, `prompt_template`, and `response_template` when the default wiring doesn't fit your use case — typically when integrating with reasoning models that don't support system prompts.

```python
custom_agent = Agent(
    role="Customer Service Representative",
    goal="Assist customers with their inquiries",
    backstory="Experienced in customer support with a focus on satisfaction",
    use_system_prompt=False,
    system_template="""system\n{{ .System }}""",
    prompt_template="""user\n{{ .Prompt }}""",
    response_template="""assistant\n{{ .Response }}""",
)
```

### Direct `kickoff()`

You don't need a Crew to run an agent. The `Agent.kickoff()` method runs a single query and returns a `LiteAgentOutput`.

```python
from pydantic import BaseModel
from typing import List

class ResearchFindings(BaseModel):
    main_points: List[str]
    key_technologies: List[str]
    future_predictions: str

result = researcher.kickoff(
    "Summarize the latest developments in AI for 2026",
    response_format=ResearchFindings,
)

print(result.pydantic.main_points)
```

The async equivalent is `agent.kickoff_async(...)`.

## Tasks

A `Task` is a unit of work. It has a `description` (what to do), an `expected_output` (what success looks like), an `agent`, and optional `context` (other tasks whose outputs should be fed in).

### Full reference

| Attribute | Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| Description | `description` | `str` | _required_ | Clear statement of what the task entails |
| Expected output | `expected_output` | `str` | _required_ | Detailed description of task completion |
| Name | `name` | `Optional[str]` | `None` | Identifier for the task |
| Agent | `agent` | `Optional[BaseAgent]` | `None` | Agent responsible for execution |
| Tools | `tools` | `List[BaseTool]` | `[]` | Tools the agent may use for this task |
| Context | `context` | `Optional[List["Task"]]` | `None` | Tasks whose outputs provide context |
| Async execution | `async_execution` | `Optional[bool]` | `False` | Run asynchronously |
| Human input | `human_input` | `Optional[bool]` | `False` | Require human review before completing |
| Markdown | `markdown` | `Optional[bool]` | `False` | Return output formatted in Markdown |
| Output file | `output_file` | `Optional[str]` | `None` | Path for storing output |
| Create directory | `create_directory` | `Optional[bool]` | `True` | Create directory if missing |
| Output JSON | `output_json` | `Optional[Type[BaseModel]]` | `None` | Pydantic model for JSON structure |
| Output Pydantic | `output_pydantic` | `Optional[Type[BaseModel]]` | `None` | Pydantic model for output |
| Callback | `callback` | `Optional[Any]` | `None` | Function executed after completion |
| Guardrail | `guardrail` | `Optional[Callable]` | `None` | Validate output before next task |
| Guardrails | `guardrails` | `Optional[List[Callable]]` | `None` | List of guardrails (overrides `guardrail`) |
| Guardrail max retries | `guardrail_max_retries` | `Optional[int]` | `3` | Max retries on guardrail failure |

### Context — chaining tasks

The `context` parameter is how CrewAI implements task dependencies. A task with `context=[research_task]` receives the *raw output* of `research_task` as part of its prompt.

```python
research_task = Task(
    description="Research the latest developments in AI",
    expected_output="A list of recent AI developments",
    agent=researcher,
)

analysis_task = Task(
    description="Analyze the research findings and identify key trends",
    expected_output="Analysis report of AI trends",
    agent=analyst,
    context=[research_task],
)
```

Forward references are rejected at runtime — `analysis_task` cannot reference a task defined after it.

### Guardrails

A guardrail is a function that validates the task output before the next task starts. Use it to enforce length, format, or content rules.

```python
from typing import Tuple, Any
from crewai import TaskOutput

def validate_blog_content(result: TaskOutput) -> Tuple[bool, Any]:
    word_count = len(result.raw.split())
    if word_count > 200:
        return (False, "Blog content exceeds 200 words")
    return (True, result.raw.strip())

blog_task = Task(
    description="Write a blog post about AI",
    expected_output="A blog post under 200 words",
    agent=blog_agent,
    guardrail=validate_blog_content,
    guardrail_max_retries=3,
)
```

LLM-based guardrails are also supported — pass a string describing the rule and the agent's own LLM validates.

### Structured output

Set `output_pydantic=<MyPydanticModel>` and the task output is parsed into a typed model.

```python
from pydantic import BaseModel

class Blog(BaseModel):
    title: str
    content: str

task = Task(
    description="Create a blog title and content on a given topic.",
    expected_output="A compelling blog title and well-written content.",
    agent=blog_agent,
    output_pydantic=Blog,
)

result = crew.kickoff()
print(result.pydantic.title)
print(result.pydantic.content)
```

Only **one** output type can be set per task — pick `output_file`, `output_json`, *or* `output_pydantic`, not multiple.

## Crews

A `Crew` is a scheduler. It owns a list of agents, a list of tasks, and a process that controls how tasks are dispatched.

### Configuration

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tasks` | `List[Task]` | _required_ | List of tasks assigned to the crew |
| `agents` | `List[Agent]` | _required_ | List of agents in the crew |
| `process` | `Process` | `Process.sequential` | Process flow — `sequential` or `hierarchical` |
| `verbose` | `bool` | `False` | Logging verbosity |
| `manager_llm` | `str` | _None_ | LLM used by the manager agent (required for hierarchical) |
| `manager_agent` | `BaseAgent` | _None_ | Custom manager agent (overrides `manager_llm`) |
| `function_calling_llm` | `Any` | _None_ | LLM used for function calling across all agents |
| `memory` | `bool` | `False` | Enable short-term, long-term, entity memory |
| `cache` | `bool` | `True` | Cache tool results across runs |
| `max_rpm` | `int` | _None_ | Crew-level rate limit (overrides per-agent settings) |
| `embedder` | `Dict[str, Any]` | _None_ | Embedding configuration for memory |
| `step_callback` | `Any` | _None_ | Called after each step of every agent |
| `task_callback` | `Any` | _None_ | Called after each task completes |
| `output_log_file` | `str` | _None_ | Save logs to `.txt` or `.json` |
| `planning` | `bool` | `False` | Enable `AgentPlanner` |
| `planning_llm` | `str` | _None_ | LLM used by the planner |
| `knowledge_sources` | `List[BaseKnowledgeSource]` | _None_ | Knowledge bases accessible to all agents |
| `stream` | `bool` | `False` | Enable real-time streaming (`CrewStreamingOutput`) |
| `chat_llm` | `str` | _None_ | LLM for `crewai chat` CLI |
| `tracing` | `bool` | _None_ | OpenTelemetry tracing toggle |
| `skills` | `Path \| Skill` | _None_ | Skill definitions for agents |
| `checkpoint` | `CheckpointConfig` | _None_ | Automatic checkpointing configuration |

### Process types

1. **`Process.sequential`** — tasks run in the order defined. The output of each task is appended to the context of the next.
2. **`Process.hierarchical`** — a manager agent (specified by `manager_llm` or `manager_agent`) picks which worker runs next based on the task description and the current state. Requires `manager_llm`.

> **Tip:** Hierarchical mode is more flexible but compounds token cost. A 3-agent hierarchical crew with delegation can multiply a single user's prompt by **5–10x** at the API. Set `max_iter` and `max_rpm` aggressively.

### Kickoff

```python
result = crew.kickoff(inputs={"topic": "AI Agents"})

# Streaming
for chunk in crew.kickoff(inputs={"topic": "AI"}, stream=True):
    print(chunk.content, end="", flush=True)

# Async
result = await crew.kickoff_async(inputs={"topic": "AI"})

# For-each
results = crew.kickoff_for_each(inputs=[{"topic": "A"}, {"topic": "B"}])
```

The result is a `CrewOutput` with `raw`, `pydantic`, `json_dict`, `tasks_output`, and `token_usage`.

### Checkpointing

Add `checkpoint=True` to save state after every task. Resume with `Crew.from_checkpoint(path)`.

```python
crew = Crew(
    agents=[...],
    tasks=[...],
    checkpoint=True,                    # saves to ./.checkpoints
)

crew = Crew.from_checkpoint("./.checkpoints/latest.json")
crew.kickoff()                          # resumes from where it stopped
```

For fine-grained control, pass a `CheckpointConfig`:

```python
from crewai.checkpoint import CheckpointConfig, JsonProvider, SqliteProvider

crew = Crew(
    agents=[...],
    tasks=[...],
    checkpoint=CheckpointConfig(
        location="./.checkpoints",
        on_events=["task_completed"],   # or ["*"] for all events
        provider=JsonProvider(),        # or SqliteProvider for larger state
        max_checkpoints=10,
    ),
)
```

## Memory

CrewAI 1.6 ships a **unified memory system** that replaces the older split between short-term, long-term, and entity memory with a single `Memory` class. Behind the scenes it uses LanceDB and an LLM to infer scope, categories, and importance when saving.

### Standalone usage

```python
from crewai import Memory

memory = Memory()
memory.remember("The API rate limit is 1000 requests per minute.")
memory.remember("Our staging environment uses port 8080.")

matches = memory.recall("What are our API limits?", limit=5)
for m in matches:
    print(f"[{m.score:.2f}] {m.record.content}")
```

`Memory.recall()` returns a composite score that blends semantic similarity, recency, and importance:

```text
composite = semantic_weight * similarity
          + recency_weight * decay
          + importance_weight * importance
```

Defaults: `semantic_weight=0.5`, `recency_weight=0.3`, `importance_weight=0.2`, `recency_half_life_days=30`.

### Configuration

| Parameter | Default |
| :--- | :--- |
| `llm` | `"gpt-4o-mini"` |
| `storage` | `"lancedb"` (under `./.crewai/memory`) |
| `embedder` | OpenAI `text-embedding-3-large` |
| `recency_weight` | `0.3` |
| `semantic_weight` | `0.5` |
| `importance_weight` | `0.2` |
| `recency_half_life_days` | `30` |
| `consolidation_threshold` | `0.85` |
| `query_analysis_threshold` | `200` |

### Hierarchical scopes

Memories organize into a tree like `/`, `/project/alpha`, `/agent/researcher`. The LLM infers scope when not explicitly provided.

```python
memory.remember("Sprint velocity is 42 points", scope="/team/metrics")

agent_memory = memory.scope("/agent/researcher")
agent_memory.remember("Found three relevant papers on LLM memory.")
```

### Slices

A slice combines context from multiple disjoint scopes (read-only by default).

```python
agent_view = memory.slice(
    scopes=["/agent/researcher", "/company/knowledge"],
    read_only=True,
)
```

### Recall depth

```python
matches = memory.recall("What did we decide?", depth="shallow")
matches = memory.recall("Summarize all architecture decisions", depth="deep")
```

Deep recall uses multi-step `RecallFlow` with query analysis. Short queries (<200 chars by default) skip the LLM analysis step.

## Tools

CrewAI ships a separate package — `crewai-tools` — that bundles pre-built tools for the most common use cases.

| Tool | Purpose |
| :--- | :--- |
| `SerperDevTool` | Google search via Serper API |
| `ScrapeWebsiteTool` | Scrape a single URL and return cleaned text |
| `FileReadTool` | Read a file from disk with size limit |
| `FileWriteTool` | Write a string to a file |
| `DirectoryReadTool` | List and read files in a directory |
| `DirectorySearchTool` | Recursively search a directory by content |
| `CodeInterpreterTool` | Execute Python in a sandbox (use E2B or Modal) |
| `RagTool` | Retrieval-augmented generation over a knowledge base |
| `TXTSearchTool` | RAG over local `.txt` files |
| `CSVSearchTool` | RAG over local `.csv` files |
| `JSONSearchTool` | RAG over local `.json` files |
| `MDXSearchTool` | RAG over local `.mdx` files |
| `PDFSearchTool` | RAG over local `.pdf` files |
| `PGSearchTool` | RAG over a PostgreSQL table |
| `WebsiteSearchTool` | RAG over a website (crawl + index) |
| `YoutubeVideoSearchTool` | RAG over a YouTube video transcript |
| `GithubSearchTool` | Search GitHub repos, code, issues |
| `SnowflakeSearchTool` | Query a Snowflake warehouse |
| `StripeTool` | Stripe API helpers |
| `ExaSearchTool` | Neural search via Exa |
| `FirecrawlScrapeWebsiteTool` | Crawl & scrape with Firecrawl |

### Custom tools

Implement the `BaseTool` interface to add your own.

```python
from crewai.tools import BaseTool
from pydantic import Field

class MyJiraSearchTool(BaseTool):
    name: str = "Jira Search"
    description: str = "Search Jira issues by JQL query string."

    jira_url: str = Field(...)
    api_token: str = Field(...)

    def _run(self, query: str) -> str:
        # Make the API call, return a string the agent can read.
        ...
        return results
```

Register it on an agent:

```python
jira_tool = MyJiraSearchTool(jira_url=..., api_token=...)
agent = Agent(role="...", tools=[jira_tool], ...)
```

## LLM providers

CrewAI integrates with multiple LLM providers through native SDKs (OpenAI, Anthropic, Google, Azure, AWS Bedrock, Snowflake) and LiteLLM for everything else.

### Native providers

| Provider | Env var | Example model string |
| :--- | :--- | :--- |
| OpenAI | `OPENAI_API_KEY` | `openai/gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-sonnet-4-6` |
| Google Gemini | `GOOGLE_API_KEY` | `gemini/gemini-2.5-pro` |
| Azure | `AZURE_API_KEY`, `AZURE_ENDPOINT` | `azure/gpt-4o` |
| AWS Bedrock | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `bedrock/us.anthropic.claude-sonnet-4-6` |
| Snowflake Cortex | `SNOWFLOKE_PAT` | `snowflake/openai-gpt-4.1` |

### LiteLLM-powered providers

| Provider | Env var | Example model string |
| :--- | :--- | :--- |
| Groq | `GROQ_API_KEY` | `groq/llama-3.3-70b-versatile` |
| Mistral | `MISTRAL_API_KEY` | `mistral/mistral-large-latest` |
| Ollama (local) | _none_ | `ollama/llama3.2` |
| Hugging Face | `HF_TOKEN` | `huggingface/meta-llama/Meta-Llama-3.1-8B-Instruct` |
| Fireworks AI | `FIREWORKS_API_KEY` | `fireworks_ai/accounts/fireworks/models/llama-v3-70b-instruct` |
| Perplexity | `PERPLEXITY_API_KEY` | `perplexity/sonar-pro` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras/gpt-oss-120b` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/deepseek/deepseek-r1` |
| Nvidia NIM | `NVIDIA_API_KEY` | `nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b` |

### Reasoning models

For reasoning models (OpenAI `o-series`, Anthropic `claude-sonnet-4-6` with extended thinking), pass model-specific parameters through `LLM(...)`:

```python
from crewai import LLM

# OpenAI reasoning
llm = LLM(model="openai/o3", reasoning_effort="high")

# Anthropic extended thinking
llm = LLM(
    model="anthropic/claude-sonnet-4-6",
    thinking={"type": "enabled", "budget_tokens": 5000},
    max_tokens=10000,
)
```

> Some reasoning models **ignore** `temperature` and `top_p`. Treat these as no-ops and use the model's reasoning controls instead.

### Drop unsupported params

If a model rejects `stop`, `top_p`, or other legacy params, drop them:

```python
llm = LLM(
    model="openai/o3",
    drop_params=True,
    additional_drop_params=["stop"],
)
```

## Flows

A **Flow** is the higher-level orchestration primitive. Use it when you need:

- Stateful workflows that persist across multiple Crew executions.
- Conditional branching based on Crew outputs.
- Long-running processes (cron jobs, event listeners, async pipelines).
- Audit trails and step-level logging.

### Minimal Flow

```python
from crewai.flow.flow import Flow, listen, start

class ResearchFlow(Flow):
    @start()
    def generate_topic(self):
        return "CrewAI multi-agent patterns"

    @listen(generate_topic)
    def run_crew(self, topic):
        result = research_crew.kickoff(inputs={"topic": topic})
        return result.raw
```

The `@start()` decorator marks the entry point; `@listen(method_name)` chains steps and receives the previous step's return value. Flows can also `or_`, `and_`, and branch based on conditions.

## Getting started

### Install

```bash
# Core framework
pip install crewai

# Optional: tool package
pip install 'crewai[tools]'

# Optional: every LLM provider via LiteLLM
pip install 'crewai[litellm]'
```

### Minimal crew (sequential)

```python
from crewai import Agent, Crew, Process, Task
from crewai_tools import SerperDevTool

researcher = Agent(
    role="Researcher",
    goal="Find the most cited papers on {topic}",
    backstory="Senior research analyst",
    tools=[SerperDevTool()],
)

writer = Agent(
    role="Writer",
    goal="Draft a 500-word summary",
    backstory="Technical writer",
)

research_task = Task(
    description="Summarize the top three results on {topic}",
    expected_output="Bullet list of three findings",
    agent=researcher,
)

draft = Task(
    description="Write a 500-word article using the research",
    expected_output="Polished article",
    agent=writer,
    context=[research_task],
)

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, draft],
    process=Process.sequential,
)

result = crew.kickoff(inputs={"topic": "CrewAI"})
print(result.raw)
```

### Project scaffold

The CLI scaffolds a working project. It asks for an LLM provider and writes a `crew.jsonc`, `agents/`, `tasks/`, and `tools/` directory.

```bash
crewai create crew my_research_crew
cd my_research_crew
crewai run
```

To scaffold the classic YAML/Python form instead:

```bash
crewai create crew my_research_crew --classic
```

## Production tips

These patterns come up repeatedly in production deployments.

### 1. Pin LiteLLM

```toml
# pyproject.toml
crewai = ">=1.6,<2.0"
litellm = ">=1.40,<2.0"
```

LiteLLM is a fast-moving target. Some model features (vision, JSON-schema tools, reasoning controls) need a recent LiteLLM version.

### 2. Set guardrails everywhere

A guardrail is cheap. A missed guardrail in production is not.

```python
def must_include_citation(result: TaskOutput) -> Tuple[bool, Any]:
    if "http" not in result.raw and "doi:" not in result.raw:
        return (False, "Output must cite a source URL or DOI")
    return (True, result.raw)

blog_task = Task(
    description=...,
    expected_output=...,
    agent=writer,
    guardrail=must_include_citation,
    guardrail_max_retries=3,
)
```

### 3. Log step_callback for observability

```python
import logging

logger = logging.getLogger("crew")

def step_logger(step_output):
    logger.info("step complete: %s", step_output)

crew = Crew(agents=[...], tasks=[...], step_callback=step_logger)
```

Pair with OpenTelemetry by setting `tracing=True` and configuring `OTEL_EXPORTER_OTLP_ENDPOINT`.

### 4. Use async kickoff for I/O-bound crews

```python
results = await asyncio.gather(
    crew_a.kickoff_async(inputs={"topic": "A"}),
    crew_b.kickoff_async(inputs={"topic": "B"}),
)
```

Native `akickoff()` is preferred over `kickoff_async()` — the latter is a thread-based wrapper.

### 5. Cache aggressively in dev, sparingly in prod

```python
crew = Crew(agents=[...], tasks=[...], cache=True)   # dev: free
crew = Crew(agents=[...], tasks=[...], cache=False)  # prod: avoid stale results
```

## Caveats

- **Token cost is real.** A 3-agent crew with delegation can multiply a single user's prompt by 5–10x. Hierarchical mode compounds this. Set `max_iter` and `max_rpm` aggressively.
- **Debugging is verbose.** A failed delegation chain prints a lot of agent chatter. Bring a structured logger; tail the `CrewAI` namespace.
- **LiteLLM is a fast-moving target.** Some model features (vision, tools with JSON schema) need a recent LiteLLM version. Pin both packages.
- **Not a DAG runner.** If your task graph is strictly acyclic and you want deterministic execution, LangGraph or a custom orchestrator is a better fit.
- **`allow_code_execution` is deprecated.** Use `CodeInterpreterTool` with E2B or Modal for sandboxed code execution.
- **JSONC config has no schema validation.** A typo in `crew.jsonc` is a runtime error. Use `crewai validate` before deploying.

## Deployment notes

### Docker

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen

COPY src ./src
COPY agents ./agents
COPY tasks ./tasks
COPY crew.jsonc ./

ENV CREWAI_STORAGE_DIR=/app/.crewai
CMD ["crewai", "run"]
```

### Environment variables

| Variable | Required for |
| :--- | :--- |
| `OPENAI_API_KEY` | OpenAI provider |
| `ANTHROPIC_API_KEY` | Anthropic provider |
| `MODEL` | Default model when not set on the agent |
| `CREWAI_STORAGE_DIR` | Memory storage path |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry export |
| `CREWAI_TRACING_ENABLED` | Toggle tracing |

### Resources

| Resource | Quantity |
| :--- | :--- |
| CPU | 1+ vCPU |
| Memory | 512 MB minimum, 2 GB recommended |
| Storage | 1 GB for memory + logs |
| Network | Outbound HTTPS to LLM provider |
| Tokens | Dominates over compute cost |

## FAQ

<details>
<summary><strong>When should I use a Flow instead of a Crew?</strong></summary>

Use a Crew for one-shot or short-lived multi-agent work. Use a Flow when you need persistent state, branching on outputs, retries, or long-running processes that span multiple Crew invocations. For production, start with a Flow and call Crews from inside it.
</details>

<details>
<summary><strong>Can I run a Crew without a manager_llm in hierarchical mode?</strong></summary>

No. Hierarchical mode requires either `manager_llm` (a model string) or `manager_agent` (a custom `BaseAgent` instance). If neither is set, the crew falls back to sequential mode at runtime.
</details>

<details>
<summary><strong>How do I handle rate limits?</strong></summary>

Set `max_rpm` on the agent or the crew. The framework will throttle calls to stay under the limit. For backoff-and-retry on `429` responses, set `max_retry_limit` on the agent.
</details>

<details>
<summary><strong>Can I use local models?</strong></summary>

Yes — any LiteLLM-supported provider works. For Ollama, set `ollama/llama3.2` (or another model) and pass `base_url="http://localhost:11434"` if Ollama is not on the default port.
</details>

<details>
<summary><strong>How do I debug a stuck crew?</strong></summary>

Set `verbose=True` on the Crew and on each Agent. Inspect `crew_output.tasks_output` for per-task raw output. Use `step_callback` to log every step. For deeper inspection, enable `tracing=True` and view the trace in your OpenTelemetry collector.
</details>

## When to choose CrewAI

Pick CrewAI if:

- ✅ You want role-based, multi-agent collaboration out of the box.
- ✅ You want YAML/JSONC configuration that version-controls your agent team.
- ✅ You need delegation, hierarchical coordination, or guardrails.
- ✅ You want a stable, well-maintained library with a large community.

Look elsewhere if:

- ❌ You need a strict DAG executor (use [LangGraph](https://langchain-ai.github.io/langgraph/) or [Prefect](https://prefect.io/)).
- ❌ You need type-safe graphs in TypeScript (use [Inngest](https://www.inngest.com/) or [temporal.io](https://temporal.io/)).
- ❌ Your workload is one agent + tools (a raw LiteLLM loop is enough).
- ❌ You need fine-grained GPU control or a fully local stack — combine with [Ollama](https://ollama.com/) but verify compatibility.

## Related projects

CrewAI sits in a wider ecosystem. Adjacent tools to consider:

- **[LangGraph](https://langchain-ai.github.io/langgraph/)** — graph-based orchestration with explicit state and cycles.
- **[AutoGen](https://github.com/microsoft/autogen)** — Microsoft's multi-agent framework with conversation-first design.
- **[LlamaIndex](https://www.llamaindex.com/)** — data framework for RAG; pairs well with CrewAI for knowledge-heavy agents.
- **[Dify](https://dify.ai/)** — visual LLM app builder with agent nodes.
- **[Flowise](https://flowiseai.com/)** — drag-and-drop LangChain UI; great for non-developers.

---

<sub>Last reviewed by the Grove curators on <time datetime="2026-08-10">2026-08-10</time>. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the `crewai chat` REPL to exit. Found an outdated section? Open an issue at <https://github.com/tortuvshin/grove>.</sub>