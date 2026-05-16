#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import QRCode from "qrcode";

const API_BASE = process.env.LEAFEEP_API_URL ?? "https://api.leafeep.com";
const FRONTEND_URL = process.env.LEAFEEP_FRONTEND_URL ?? "https://leafeep.com";
const API_KEY = process.env.LEAFEEP_API_KEY ?? "";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error(
      "LEAFEEP_API_KEY is not set. Get your free API key at https://leafeep.com → Log in → Claude Integration."
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

interface QuestionSetDetail {
  id: number;
  title: string;
  questions: Array<{
    id: number;
    orderIndex: number;
    type: string;
    question: string;
    code?: string;
    choices?: string[];
    answer: string;
    score: number;
  }>;
  createdAt: string;
}

interface ExamCreateResponse {
  id: number;
  code: string;
  url: string;
}

interface QuestionSetListItem {
  id: number;
  title: string;
  questionCount: number;
  createdAt: string;
}

interface ExamResponse {
  id: number;
  code: string;
  status: string;
  questionSetTitle: string;
  totalSubmissions: number;
  submittedCount: number;
  createdAt: string;
  closedAt: string | null;
}

interface SubmissionResponse {
  id: number;
  studentName: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  answers: Array<{
    questionId: number;
    answerText: string | null;
  }> | null;
}

interface GradingDataResponse {
  examId: number;
  title: string;
  questions: Array<{
    questionId: number;
    orderIndex: number;
    type: string;
    question: string;
    code: string | null;
    correctAnswer: string;
    score: number;
    studentAnswers: Array<{
      answerId: number;
      submissionId: number;
      studentName: string;
      answerText: string | null;
      grade: {
        gradeId: number;
        score: number | null;
        comment: string | null;
        result: string | null;
      } | null;
    }>;
  }>;
}

interface ResultsResponse {
  title: string;
  students: Array<{
    studentName: string;
    status: string;
    totalScore: number;
    maxScore: number;
    scores: Array<number | null>;
  }>;
  questionStats: Array<{
    questionIndex: number;
    question: string;
    correctRate: number;
    avgScore: number;
    maxScore: number;
  }>;
}

const server = new McpServer({
  name: "leafeep",
  version: "0.2.0",
  description: "Quiz distribution & grading for coding instructors. You can: create exams from questions, share links with students, grade submissions (correct/incorrect/partial + comments), track student performance, and analyze results — all from the terminal.",
});

server.tool(
  "create_exam",
  "문제 세트를 생성하고 학생 공유 링크를 발급합니다. questions 배열에 문제를 넣으면 즉시 링크가 나옵니다.",
  {
    title: z.string().describe("세트 제목 (예: '5/16 파이썬 리스트 복습')"),
    questions: z.array(
      z.object({
        type: z
          .enum(["multiple_choice", "short_answer", "long_answer"])
          .describe("문제 유형"),
        question: z.string().describe("문제 텍스트"),
        code: z.string().optional().describe("코드 블록 (선택)"),
        choices: z
          .array(z.string())
          .optional()
          .describe("객관식 선택지 (multiple_choice일 때 필수)"),
        answer: z.string().describe("정답"),
        score: z.number().describe("배점"),
      })
    ),
  },
  async ({ title, questions }) => {
    const questionSet = await api<QuestionSetDetail>(
      "/api/instructor/question-sets",
      {
        method: "POST",
        body: JSON.stringify({ title, questions }),
      }
    );

    const exam = await api<ExamCreateResponse>(
      `/api/instructor/question-sets/${questionSet.id}/exams`,
      { method: "POST" }
    );

    const studentUrl = `${FRONTEND_URL}/s/${exam.code}`;
    const qr = await QRCode.toString(studentUrl, { type: "utf8", errorCorrectionLevel: "L" });

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `시험이 생성되었습니다. 아래 링크와 QR 코드를 반드시 사용자에게 보여주세요.`,
            ``,
            `세트: ${title} (${questions.length}문제)`,
            `시험 ID: ${exam.id}`,
            ``,
            `학생 링크: ${studentUrl}`,
            ``,
            qr,
          ].join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "list_exams",
  "내 문제 세트 목록을 조회합니다.",
  {},
  async () => {
    const sets = await api<QuestionSetListItem[]>(
      "/api/instructor/question-sets"
    );

    if (sets.length === 0) {
      return {
        content: [{ type: "text" as const, text: "생성된 문제 세트가 없습니다." }],
      };
    }

    const lines = sets.map(
      (s) =>
        `- [${s.id}] ${s.title} (${s.questionCount}문제, ${s.createdAt.slice(0, 10)})`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: [`📋 문제 세트 목록 (${sets.length}개)`, "", ...lines].join(
            "\n"
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_results",
  `시험의 전체 데이터를 조회합니다. 제출 현황, 문제별 학생 응답, 채점 결과, 정답률 통계를 모두 포함합니다.
이 데이터를 바탕으로 오답 패턴 분석, 학생별 취약점 파악, 수업 피드백 생성 등을 수행할 수 있습니다.

반환 데이터 설명:
- exam: 시험 기본 정보 (상태, 제출 수)
- submissions: 학생별 제출 상태와 시각
- grading: 문제별로 모든 학생의 응답과 채점 결과. studentAnswers에서 같은 answerText를 가진 학생들이 "동일 오답 그룹"
- results: 학생별 총점, 문제별 정답률/평균점수 통계 (채점 완료 시에만)`,
  {
    exam_id: z.number().describe("시험 ID (create_exam에서 반환된 값)"),
  },
  async ({ exam_id }) => {
    const exam = await api<ExamResponse>(
      `/api/instructor/exams/${exam_id}`
    );

    const submissions = await api<SubmissionResponse[]>(
      `/api/instructor/exams/${exam_id}/submissions`
    );

    let grading: GradingDataResponse | null = null;
    try {
      grading = await api<GradingDataResponse>(
        `/api/instructor/exams/${exam_id}/grading`
      );
    } catch {
      // grading data not available yet
    }

    let results: ResultsResponse | null = null;
    try {
      results = await api<ResultsResponse>(
        `/api/instructor/exams/${exam_id}/results`
      );
    } catch {
      // results not available yet
    }

    const data = {
      exam: {
        id: exam.id,
        code: exam.code,
        title: exam.questionSetTitle,
        status: exam.status,
        totalSubmissions: exam.totalSubmissions,
        submittedCount: exam.submittedCount,
        createdAt: exam.createdAt,
        closedAt: exam.closedAt,
      },
      submissions: submissions.map((s) => ({
        id: s.id,
        studentName: s.studentName,
        status: s.status,
        createdAt: s.createdAt,
        submittedAt: s.submittedAt,
        answers: s.answers,
      })),
      grading: grading
        ? grading.questions.map((q) => ({
            questionId: q.questionId,
            orderIndex: q.orderIndex,
            type: q.type,
            question: q.question,
            code: q.code,
            correctAnswer: q.correctAnswer,
            maxScore: q.score,
            studentAnswers: q.studentAnswers.map((sa) => ({
              studentName: sa.studentName,
              answerText: sa.answerText,
              grade: sa.grade
                ? {
                    score: sa.grade.score,
                    result: sa.grade.result,
                    comment: sa.grade.comment,
                  }
                : null,
            })),
          }))
        : null,
      results: results
        ? {
            students: results.students.map((s) => ({
              studentName: s.studentName,
              status: s.status,
              totalScore: s.totalScore,
              maxScore: s.maxScore,
              scores: s.scores,
            })),
            questionStats: results.questionStats.map((q) => ({
              questionIndex: q.questionIndex,
              question: q.question,
              correctRate: q.correctRate,
              avgScore: q.avgScore,
              maxScore: q.maxScore,
            })),
          }
        : null,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "close_exam",
  "시험을 마감합니다 (제출 잠금). 마감 후 채점을 시작할 수 있습니다.",
  {
    exam_id: z.number().describe("시험 ID"),
  },
  async ({ exam_id }) => {
    await api(`/api/instructor/exams/${exam_id}/close`, { method: "PUT" });
    return {
      content: [
        {
          type: "text" as const,
          text: `🔒 시험이 마감되었습니다. 더 이상 학생이 제출할 수 없습니다.`,
        },
      ],
    };
  }
);

server.tool(
  "grade_exam",
  `시험을 채점합니다. get_results로 가져온 grading 데이터의 answerId를 사용하세요.
각 답안에 대해 result(correct/incorrect/partial), score(배점 이하 정수), comment(선택)를 지정합니다.
한 번에 여러 답안을 채점할 수 있습니다. 이미 채점된 답안도 덮어씁니다.`,
  {
    exam_id: z.number().describe("시험 ID"),
    grades: z.array(
      z.object({
        answerId: z.number().describe("답안 ID (grading.studentAnswers[].answerId)"),
        result: z.enum(["correct", "incorrect", "partial"]).describe("채점 결과"),
        score: z.number().describe("부여할 점수 (0 ~ 해당 문제 배점)"),
        comment: z.string().optional().describe("코멘트 (선택)"),
      })
    ),
  },
  async ({ exam_id, grades }) => {
    await api(`/api/instructor/exams/${exam_id}/grading`, {
      method: "PUT",
      body: JSON.stringify({ grades }),
    });

    const correct = grades.filter((g) => g.result === "correct").length;
    const incorrect = grades.filter((g) => g.result === "incorrect").length;
    const partial = grades.filter((g) => g.result === "partial").length;

    return {
      content: [
        {
          type: "text" as const,
          text: `채점 완료: ${grades.length}건 저장 (정답 ${correct}, 오답 ${incorrect}, 부분 정답 ${partial})`,
        },
      ],
    };
  }
);

server.tool(
  "list_students",
  `내 학생 목록을 조회합니다. 모든 시험에서 제출한 학생 이름을 중복 없이 보여줍니다.
각 학생의 응시 횟수, 채점된 시험 수, 평균 점수율(0~1)을 포함합니다.`,
  {},
  async () => {
    const students = await api<Array<{
      studentName: string;
      examCount: number;
      gradedExamCount: number;
      avgScoreRate: number | null;
      lastSubmittedAt: string | null;
    }>>("/api/instructor/students");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(students, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_student_history",
  `특정 학생의 전체 시험 이력을 조회합니다. 시험별로 점수, 정답/오답 수, 문제별 응답과 채점 결과를 모두 포함합니다.
이 데이터로 학생의 취약 유형 분석, 점수 추이 파악, 학부모 상담 자료 생성 등을 할 수 있습니다.`,
  {
    student_name: z.string().describe("학생 이름 (list_students에서 확인한 이름)"),
  },
  async ({ student_name }) => {
    const history = await api<{
      studentName: string;
      examCount: number;
      examResults: Array<{
        examId: number;
        examCode: string;
        examTitle: string;
        submittedAt: string | null;
        totalScore: number;
        maxScore: number;
        correctCount: number;
        incorrectCount: number;
        questions: Array<{
          questionId: number;
          orderIndex: number;
          type: string;
          question: string;
          code: string | null;
          correctAnswer: string;
          maxScore: number;
          studentAnswer: string | null;
          score: number | null;
          result: string | null;
          comment: string | null;
        }>;
      }>;
    }>(`/api/instructor/students/${encodeURIComponent(student_name)}`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(history, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
