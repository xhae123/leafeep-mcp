# leafeep-mcp

MCP server for [Leafeep](https://leafeep.com) — create, distribute, grade, and analyze exams from Claude.

## Quick Start

```bash
claude mcp add leafeep -s user -- npx leafeep-mcp
```

That's it. On first use, Claude will show a login link — click it to connect your Google account.

## What you can do

| Tool | What it does | Example |
|---|---|---|
| `setup` | Log in to Leafeep | "Connect to Leafeep" |
| `create_exam` | Create questions + student link | "Make 5 Python list questions" |
| `grade_exam` | Grade student submissions | "Grade the exam and summarize" |
| `get_results` | Get full submission + grading data | "Show exam results" |
| `list_exams` | List your question sets | "Show my exams" |
| `close_exam` | Close submissions | "Close the exam" |
| `list_students` | Student list with scores | "Show all students" |
| `get_student_history` | Full history for a student | "Analyze weak points for Kim" |

## Advanced: API Key (optional)

If you prefer using an API key instead of browser login, get one from [leafeep.com](https://leafeep.com) → Claude Integration, then:

```bash
claude mcp add leafeep -s user -- npx leafeep-mcp -e LEAFEEP_API_KEY=lfp_your_key
```

## Links

- **Web:** [leafeep.com](https://leafeep.com)
- **API limit:** 1,000 calls/day (free)
