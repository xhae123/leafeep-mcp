# leafeep-mcp

MCP server for creating and managing [Leafeep](https://leafeep.com) exams from Claude Code.

## Installation

```bash
npm install -g github:xhae123/leafeep-mcp
claude mcp add leafeep -s user npx leafeep-mcp \
  -e LEAFEEP_API_KEY=lfp_... \
  -e LEAFEEP_API_URL=https://api.leafeep.com \
  -e LEAFEEP_FRONTEND_URL=https://leafeep.com
```

Get your API key from the [leafeep.com](https://leafeep.com) dashboard.

## Tools

| Tool | Description |
|---|---|
| `create_exam` | Create a question set and generate student links |
| `list_exams` | List all question sets |
| `get_results` | Get submission status and grading data (JSON) |
| `close_exam` | Close an exam |
| `list_students` | List students with average scores |
| `get_student_history` | Get full exam history for a student |
