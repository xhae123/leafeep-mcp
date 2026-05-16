# Leafeep MCP Server

Claude Code / Codex에서 Leafeep을 사용하기 위한 MCP 서버.

## 설치 및 설정

### 1. 빌드

```bash
cd leafeep-mcp
npm install
npm run build
```

### 2. API Key 발급

Leafeep 웹에서 로그인 후, 설정에서 API Key를 발급받는다.
또는 API로 직접 발급:

```bash
curl -X POST https://api.leafeep.kr/api/auth/api-key \
  -H "Authorization: Bearer <JWT>"
```

### 3. Claude Code에 등록

`~/.claude/settings.json` 또는 프로젝트 `.claude/settings.json`에 추가:

```json
{
  "mcpServers": {
    "leafeep": {
      "command": "node",
      "args": ["/path/to/leafeep-mcp/dist/index.js"],
      "env": {
        "LEAFEEP_API_KEY": "lfp_your_api_key_here",
        "LEAFEEP_API_URL": "https://api.leafeep.kr"
      }
    }
  }
}
```

## 사용 가능한 도구

| 도구 | 설명 |
|---|---|
| `create_exam` | 문제 세트 생성 + 학생 링크 발급 |
| `list_exams` | 내 문제 세트 목록 조회 |
| `get_results` | 시험 제출 현황 + 채점 결과 |
| `close_exam` | 시험 마감 (제출 잠금) |

## 사용 예시

```
"파이썬 리스트 슬라이싱 5문제 만들어서 Leafeep에 올려줘"
"내 시험 목록 보여줘"
"시험 ID 3번 결과 확인해줘"
"시험 마감해줘"
```

## 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `LEAFEEP_API_KEY` | O | `lfp_`로 시작하는 API 키 |
| `LEAFEEP_API_URL` | X | API 서버 주소 (기본: https://api.leafeep.kr) |

## 일일 호출 제한

API Key당 일일 1,000회. 초과 시 429 응답.
