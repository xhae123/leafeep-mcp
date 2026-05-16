# leafeep-mcp

MCP server for [Leafeep](https://leafeep.com) — create, distribute, grade, and analyze exams from Claude.

## Setup

### 1. Get your API key

1. Go to [leafeep.com](https://leafeep.com) and log in with Google
2. Click **Claude Integration** on the dashboard
3. Your API key and install command will be generated automatically — just copy and paste

### 2. Install

```bash
npm install -g github:xhae123/leafeep-mcp
```

### 3. Register with Claude

```bash
claude mcp add leafeep -s user -- npx leafeep-mcp \
  -e LEAFEEP_API_KEY=lfp_your_key_here \
  -e LEAFEEP_API_URL=https://api.leafeep.com \
  -e LEAFEEP_FRONTEND_URL=https://leafeep.com
```

> **Tip:** The dashboard generates this command with your API key pre-filled. Just copy and paste.

## What you can do

| Tool | What it does | Example |
|---|---|---|
| `create_exam` | Create questions + student link | "Make 5 Python list questions" |
| `grade_exam` | Grade student submissions | "Grade the exam and summarize" |
| `get_results` | Get full submission + grading data | "Show exam results" |
| `list_exams` | List your question sets | "Show my exams" |
| `close_exam` | Close submissions | "Close the exam" |
| `list_students` | Student list with scores | "Show all students" |
| `get_student_history` | Full history for a student | "Analyze weak points for Kim" |

## Links

- **Web:** [leafeep.com](https://leafeep.com)
- **API limit:** 1,000 calls/day (free)
