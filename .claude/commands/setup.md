# Leafeep 설정

Leafeep MCP 서버를 이 Claude Code에 설정합니다.

## 진행 순서

### 1. API Key 확인

사용자에게 API Key를 물어보세요:

> Leafeep API Key가 필요합니다.
> https://leafeep.com 에 로그인 → 설정 페이지에서 발급받을 수 있습니다.
> `lfp_`로 시작하는 키를 알려주세요.

사용자가 키를 입력하면 `lfp_`로 시작하는지 확인하세요. 아니면 다시 물어보세요.

### 2. leafeep-mcp 설치

```bash
npm list -g leafeep-mcp 2>/dev/null | grep leafeep-mcp && echo "INSTALLED" || npm install -g leafeep-mcp
```

Node.js가 없으면 안내: "Node.js가 필요합니다. https://nodejs.org 에서 설치해주세요."

### 3. MCP 등록

이미 등록되어 있으면 먼저 제거하세요:

```bash
claude mcp remove leafeep -s user 2>/dev/null; claude mcp add leafeep -s user npx leafeep-mcp -e LEAFEEP_API_KEY={API_KEY} -e LEAFEEP_API_URL=https://api.leafeep.com -e LEAFEEP_FRONTEND_URL=https://leafeep.com
```

{API_KEY}를 사용자가 입력한 실제 키로 치환하세요.

### 4. 완료 안내

> Leafeep이 연결되었습니다. Claude Code를 새로 열면 바로 사용할 수 있습니다.
>
> 사용 예시:
> - "파이썬 리스트 5문제 만들어서 Leafeep에 올려줘"
> - "내 시험 목록 보여줘"
> - "김민준 학생 이력 확인해줘"
> - "시험 3번 결과 분석해줘"

### 오류 대응

- `lfp_`로 시작하지 않는 키: "API Key 형식이 다릅니다. https://leafeep.com/settings 에서 확인해주세요."
- npm 실패: "Node.js 설치가 필요합니다. https://nodejs.org"
