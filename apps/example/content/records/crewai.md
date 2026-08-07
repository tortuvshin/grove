CrewAI is a Python framework for orchestrating role-playing AI agents. You define agents with a role, a goal, and a backstory, give them tools, then declare a "crew" with a sequential or hierarchical process. CrewAI handles the message-passing loop and (with the underlying LiteLLM integration) lets each agent call any model the team can afford.

## Why it matters

- **Multi-agent patterns as code.** A crew of `Researcher` → `Writer` → `Editor` is a five-line `Crew(...)` constructor. Tools are typed Python functions; delegation between agents is built in.
- **Model-agnostic by default.** CrewAI runs on LiteLLM, so the same code can switch between GPT-4o, Claude 3.5, Llama 3.1 on Groq, or a local Ollama model without touching agent definitions.
- **Two execution modes.** Sequential (the canonical "research → write → review" pipeline) and hierarchical (a manager agent picks which worker runs next). The manager pattern is what the "auto" mode uses.
- **Plays well with the rest of the Python LLM stack.** Tools, memory, and the agent definitions are plain Python — drop into a FastAPI service, a notebook, or a scheduled job.

## How it works

CrewAI's core is a message-passing loop. Each `Agent` carries a `role`, `goal`, `backstory`, an optional `llm`, a list of `tools`, and a flag for `allow_delegation`. A `Task` binds an agent to a description, an expected output, and an optional context (other tasks to draw from). The `Crew` schedules tasks and lets each agent call its LLM with a system prompt derived from `role + goal + backstory`.

Tools are Python callables decorated with the `BaseTool` schema — the framework converts them to the model's tool-calling format and parses the response back into a Python call. Memory (short, long, entity, or custom) is opt-in per agent.

## Caveats

- **Token cost is real.** A 3-agent crew with delegation can multiply a single user's prompt by 5–10x at the API. Hierarchical mode compounds this. Set `max_iter` and `max_rpm` aggressively.
- **Debugging is verbose.** A failed delegation chain prints a lot of agent chatter. Bring a structured logger.
- **LiteLLM is a fast-moving target.** Some model features (vision, tools with JSON schema) need a recent LiteLLM version. Pin both packages.
- **Not a DAG runner.** If your task graph is strictly acyclic and you want deterministic execution, LangGraph or a custom orchestrator is a better fit.

## Deployment notes

```bash
# Install
pip install crewai
export OPENAI_API_KEY=...

# Minimal crew
from crewai import Agent, Crew, Process, Task
researcher = Agent(role="Researcher", goal="Find the most cited papers",
                   backstory="Senior research analyst",
                   tools=[arxiv_tool])
writer = Agent(role="Writer", goal="Draft a 500-word summary",
               backstory="Technical writer")
draft = Task(description="Summarize the top three results",
             agent=writer, context=[research_task])
Crew(agents=[researcher, writer],
     tasks=[research_task, draft],
     process=Process.sequential).kickoff()
```

**Minimum:** Python 3.10+ and an LLM API key (or a local Ollama endpoint). A real workload fits in 512 MB of RAM; token cost dominates over compute.
