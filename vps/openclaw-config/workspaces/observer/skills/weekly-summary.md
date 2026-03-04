# Skill: Weekly Summary

## When to use

Every Monday at 9:00 (triggered by orchestrator cron).

## Steps

1. **Collect data** (last 7 days):
   - Call `get_patterns` — all patterns from last week
   - Count new, proposed, approved, automated patterns
   - Get monitored chats list

2. **Analyze trends**:
   - Most active chats for manual routines
   - New pattern categories discovered
   - Patterns with highest ROI potential
   - Any rejected patterns (and why)

3. **Generate summary report**:

```
## Weekly Automation Report — {date range}

### Key Metrics
- New patterns discovered: X
- Proposals submitted: Y
- Agents deployed: Z
- Total estimated ROI: $NNN/month

### Top Patterns This Week
1. [description] — ROI: $X/mo, confidence: Y%
2. [description] — ROI: $X/mo, confidence: Y%
3. [description] — ROI: $X/mo, confidence: Y%

### Active Monitoring
- Chats monitored: N
- Messages analyzed: ~M

### Recommendations
- [Suggestions for improving automation coverage]
- [Chats that might benefit from monitoring]
```

4. **Deliver**: The summary is stored and available through
   the Governance Portal dashboard.

## Notes

- Keep the summary concise (under 500 words)
- Focus on actionable insights, not raw data
- Highlight patterns with ROI > $50/month
