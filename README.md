# leafeep-mcp

Claude Code에서 [Leafeep](https://leafeep.com) 시험을 만들고 관리하는 MCP 서버.

## 설치

```bash
npm install -g github:xhae123/leafeep-mcp
claude mcp add leafeep -s user npx leafeep-mcp \
  -e LEAFEEP_API_KEY=lfp_... \
  -e LEAFEEP_API_URL=https://api.leafeep.com \
  -e LEAFEEP_FRONTEND_URL=https://leafeep.com
```

API Key는 [leafeep.com](https://leafeep.com) 대시보드에서 발급.

## 도구

| 도구 | 설명 |
|---|---|
| `create_exam` | 문제 세트 생성 + 학생 링크 발급 |
| `list_exams` | 문제 세트 목록 |
| `get_results` | 제출 현황 + 채점 데이터 (JSON) |
| `close_exam` | 시험 마감 |
| `list_students` | 학생 목록 + 평균 점수 |
| `get_student_history` | 학생별 전체 시험 이력 |
