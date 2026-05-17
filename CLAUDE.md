# Leafeep MCP Server

Claude Code / Codex에서 Leafeep을 사용하기 위한 MCP 서버.

## 설치

```bash
npm install -g github:xhae123/leafeep-mcp
claude mcp add leafeep -s user -- leafeep-mcp
```

## 인증

1. 첫 실행 시 `setup` 도구가 브라우저 로그인 링크를 표시
2. Google 계정으로 로그인하면 JWT가 `~/.leafeep/token`에 자동 저장
3. 이후 자동 인증 (재로그인 불필요)

API Key는 선택 사항 (fallback). 환경변수 `LEAFEEP_API_KEY`로 설정하면 동작한다.

## 사용 가능한 도구

| 도구 | 설명 |
|---|---|
| `setup` | 브라우저 로그인으로 인증 |
| `create_exam` | 문제 세트 생성 + 학생 링크 발급 |
| `grade_exam` | 학생 제출물 채점 |
| `get_results` | 시험 제출 현황 + 채점 결과 |
| `list_exams` | 내 문제 세트 목록 조회 |
| `close_exam` | 시험 마감 (제출 잠금) |
| `list_students` | 강사의 학생 목록 + 점수 |
| `get_student_history` | 특정 학생의 전체 이력 |

## 사용 예시

```
"Leafeep에 연결해줘"
"파이썬 리스트 슬라이싱 5문제 만들어서 Leafeep에 올려줘"
"내 시험 목록 보여줘"
"시험 채점해줘"
"김 학생의 약점 분석해줘"
```

## 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `LEAFEEP_API_KEY` | X | `lfp_`로 시작하는 API 키 (fallback 인증) |
| `LEAFEEP_API_URL` | X | API 서버 주소 (기본: https://api.leafeep.com) |
| `LEAFEEP_FRONTEND_URL` | X | 프론트엔드 주소 (기본: https://leafeep.com) |

## 일일 호출 제한

API Key당 일일 1,000회. 초과 시 429 응답.
