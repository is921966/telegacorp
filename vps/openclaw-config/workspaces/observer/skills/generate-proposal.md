# Skill: Generate Proposal

## When to use

After analyzing a pattern, when you've confirmed it's worth automating.

## Steps

1. Take the analysis from `analyze-pattern` skill output
2. Create a complete Agent Package specification:

### Agent Package Structure

```
workspaces/{agent-name}/
├── SOUL.md          # Agent identity and behavior rules
├── HEARTBEAT.md     # Periodic tasks (if applicable)
├── skills/          # Individual capabilities
│   ├── main-skill.md
│   └── fallback.md
└── permissions.yaml # Required tools and access
```

3. Generate the SOUL.md content following the template:

```markdown
# {Agent Name}

## Identity
[Who this agent is and what it does]

## Mission
[Primary objective]

## Boundaries
- [What the agent CAN do]
- [What the agent CANNOT do]
- [Error handling rules]

## Capabilities
[List of MCP tools available]

## Behavior
[Step-by-step instructions for the main task]
```

4. Submit the proposal via updating the pattern status to "proposed"

## Important

- Always recommend shadow mode (minimum 7 days)
- Always set clear accuracy thresholds for promotion
- Never propose agents that handle sensitive data without
  explicit PII redaction rules
