# Heartbeat — Every 30 minutes

## Check New Patterns

1. Call `get_patterns` with status="new"
2. For each new pattern:
   - Evaluate confidence score (skip if < 0.5)
   - Evaluate estimated ROI (skip if < $10/month)
   - Check if a similar agent already exists
   - If promising → run `analyze-pattern` skill
3. Log summary of findings

## Check Monitored Chats

1. Call `get_monitored_chats`
2. Verify all expected chats are still monitored
3. Report any changes

## Health Report

Output a brief status line:
- Number of new patterns found
- Number of proposals generated
- Any errors or anomalies
