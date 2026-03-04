# Skill: Analyze Pattern

## When to use

When a new automation pattern is detected with confidence >= 0.5 and
estimated ROI >= $10/month.

## Steps

1. **Gather context**: Use `search_archive` to find example messages
   matching the pattern description. Look for 5-10 representative samples.

2. **Classify complexity**:
   - Simple (1 step, no decisions): e.g., forwarding reports
   - Medium (2-3 steps, basic logic): e.g., data aggregation + notification
   - Complex (multi-step, decisions): e.g., customer support triage

3. **Design agent blueprint**:
   - What MCP tools the agent needs
   - What permissions are required
   - What the agent's SOUL.md should contain
   - What skills the agent needs

4. **Estimate requirements**:
   - Which LLM model (deepseek-v3 for simple, claude-sonnet for complex)
   - Expected API cost per execution
   - Shadow mode duration recommendation

5. **Write proposal**: Create a structured proposal and save it as a
   new pattern with status="proposed" and your analysis in the description.

## Output format

```
## Pattern Analysis: [description]

### Problem
[What manual process was identified]

### Solution
[How an AI agent would automate it]

### Agent Blueprint
- Model: [model name]
- Tools: [list of MCP tools]
- Permissions: [what access is needed]
- Assigned chats: [which chats]

### Impact
- Frequency: [X times per period]
- Time saved: [Y minutes per occurrence]
- Monthly ROI: $[amount]

### Risks
[What could go wrong]

### Testing Plan
- Shadow mode: [X] days
- Success criteria: [metrics]
```
