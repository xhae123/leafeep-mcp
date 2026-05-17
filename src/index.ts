#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import QRCode from "qrcode";
import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const API_BASE = process.env.LEAFEEP_API_URL ?? "https://api.leafeep.com";
const FRONTEND_URL = process.env.LEAFEEP_FRONTEND_URL ?? "https://leafeep.com";
const API_KEY = process.env.LEAFEEP_API_KEY ?? "";

const TOKEN_DIR = join(homedir(), ".leafeep");
const TOKEN_FILE = join(TOKEN_DIR, "token");

function loadToken(): string | null {
  try {
    if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, "utf-8").trim();
  } catch {}
  return null;
}

function saveToken(token: string) {
  mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, token, "utf-8");
}

let authToken = loadToken();

function getAuthHeaders(): Record<string, string> {
  if (API_KEY) return { "X-API-Key": API_KEY };
  if (authToken) return { Authorization: `Bearer ${authToken}` };
  throw new Error(
    "Not authenticated. Use the setup tool to log in."
  );
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function waitForLogin(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "", `http://localhost:${port}`);
      if (url.pathname === "/callback") {
        const token = url.searchParams.get("token");
        if (token) {
          res.writeHead(200, {
            "Content-Type": "text/html",
            "Access-Control-Allow-Origin": "*",
          });
          res.end("<html><body><h2>Connected! You can close this tab.</h2></body></html>");
          server.close();
          resolve(token);
        } else {
          res.writeHead(400);
          res.end("Missing token");
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, () => {});
    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out after 5 minutes"));
    }, 300_000);
  });
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
  version: "0.3.0",
  description: "Quiz distribution & grading for coding instructors. You can: create exams from questions, share links with students, grade submissions (correct/incorrect/partial + comments), track student performance, and analyze results — all from Claude.",
});

server.tool(
  "setup",
  "Log in to Leafeep. Run this if you get authentication errors. Opens a login link — click it to connect your Google account.",
  {},
  async () => {
    if (API_KEY) {
      return { content: [{ type: "text" as const, text: "Already authenticated with API key." }] };
    }
    if (authToken) {
      try {
        await api("/api/auth/me");
        return { content: [{ type: "text" as const, text: "Already logged in." }] };
      } catch {
        authToken = null;
      }
    }

    const port = 19823 + Math.floor(Math.random() * 100);
    const loginUrl = `${FRONTEND_URL}/mcp-setup?port=${port}`;

    const tokenPromise = waitForLogin(port);

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "🔗 Leafeep login required.",
            "",
            "Open this link in your browser and log in with Google:",
            "",
            loginUrl,
            "",
            "Waiting for login... (times out in 5 minutes)",
          ].join("\n"),
        },
      ],
      _meta: {
        afterResponse: async () => {
          try {
            const token = await tokenPromise;
            authToken = token;
            saveToken(token);
          } catch {}
        },
      },
    };
  }
);

server.tool(
  "create_exam",
  "Create a question set and generate a student link. Provide questions and get a shareable link + QR code instantly.",
  {
    title: z.string().describe("Set title (e.g., '5/16 Python List Review')"),
    questions: z.array(
      z.object({
        type: z.enum(["multiple_choice", "short_answer", "long_answer"]).describe("Question type"),
        question: z.string().describe("Question text"),
        code: z.string().optional().describe("Code block (optional)"),
        choices: z.array(z.string()).optional().describe("Multiple choice options (required for multiple_choice)"),
        answer: z.string().describe("Correct answer"),
        score: z.number().describe("Points"),
      })
    ),
  },
  async ({ title, questions }) => {
    const questionSet = await api<QuestionSetDetail>("/api/instructor/question-sets", {
      method: "POST",
      body: JSON.stringify({ title, questions }),
    });
    const exam = await api<ExamCreateResponse>(`/api/instructor/question-sets/${questionSet.id}/exams`, { method: "POST" });
    const studentUrl = `${FRONTEND_URL}/s/${exam.code}`;
    const qr = await QRCode.toString(studentUrl, { type: "utf8", errorCorrectionLevel: "L" });

    return {
      content: [{
        type: "text" as const,
        text: [
          `Exam created. Share the link and QR code with your students.`,
          ``,
          `Set: ${title} (${questions.length} questions)`,
          `Exam ID: ${exam.id}`,
          ``,
          `Student link: ${studentUrl}`,
          ``,
          qr,
        ].join("\n"),
      }],
    };
  }
);

server.tool(
  "list_exams",
  "List all your question sets.",
  {},
  async () => {
    const sets = await api<QuestionSetListItem[]>("/api/instructor/question-sets");
    if (sets.length === 0) {
      return { content: [{ type: "text" as const, text: "No question sets yet." }] };
    }
    const lines = sets.map((s) => `- [${s.id}] ${s.title} (${s.questionCount} questions, ${s.createdAt.slice(0, 10)})`);
    return {
      content: [{ type: "text" as const, text: [`Question sets (${sets.length}):`, "", ...lines].join("\n") }],
    };
  }
);

server.tool(
  "get_results",
  `Get full exam data: submissions, per-question student answers, grading results, and statistics.
Use this data for error pattern analysis, student weakness identification, and class feedback.`,
  { exam_id: z.number().describe("Exam ID (from create_exam)") },
  async ({ exam_id }) => {
    const exam = await api<ExamResponse>(`/api/instructor/exams/${exam_id}`);
    const submissions = await api<SubmissionResponse[]>(`/api/instructor/exams/${exam_id}/submissions`);
    let grading: GradingDataResponse | null = null;
    try { grading = await api<GradingDataResponse>(`/api/instructor/exams/${exam_id}/grading`); } catch {}
    let results: ResultsResponse | null = null;
    try { results = await api<ResultsResponse>(`/api/instructor/exams/${exam_id}/results`); } catch {}

    const data = {
      exam: { id: exam.id, code: exam.code, title: exam.questionSetTitle, status: exam.status, totalSubmissions: exam.totalSubmissions, submittedCount: exam.submittedCount, createdAt: exam.createdAt, closedAt: exam.closedAt },
      submissions: submissions.map((s) => ({ id: s.id, studentName: s.studentName, status: s.status, createdAt: s.createdAt, submittedAt: s.submittedAt, answers: s.answers })),
      grading: grading ? grading.questions.map((q) => ({ questionId: q.questionId, orderIndex: q.orderIndex, type: q.type, question: q.question, code: q.code, correctAnswer: q.correctAnswer, maxScore: q.score, studentAnswers: q.studentAnswers.map((sa) => ({ studentName: sa.studentName, answerText: sa.answerText, grade: sa.grade ? { score: sa.grade.score, result: sa.grade.result, comment: sa.grade.comment } : null })) })) : null,
      results: results ? { students: results.students.map((s) => ({ studentName: s.studentName, status: s.status, totalScore: s.totalScore, maxScore: s.maxScore, scores: s.scores })), questionStats: results.questionStats.map((q) => ({ questionIndex: q.questionIndex, question: q.question, correctRate: q.correctRate, avgScore: q.avgScore, maxScore: q.maxScore })) } : null,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "close_exam",
  "Close an exam (lock submissions). Students can no longer submit after this.",
  { exam_id: z.number().describe("Exam ID") },
  async ({ exam_id }) => {
    await api(`/api/instructor/exams/${exam_id}/close`, { method: "PUT" });
    return { content: [{ type: "text" as const, text: "Exam closed. Students can no longer submit." }] };
  }
);

server.tool(
  "grade_exam",
  `Grade student submissions. Use answerId from get_results grading data.
Set result (correct/incorrect/partial), score, and optional comment for each answer.`,
  {
    exam_id: z.number().describe("Exam ID"),
    grades: z.array(z.object({
      answerId: z.number().describe("Answer ID (from grading.studentAnswers[].answerId)"),
      result: z.enum(["correct", "incorrect", "partial"]).describe("Grade result"),
      score: z.number().describe("Score (0 to max question score)"),
      comment: z.string().optional().describe("Comment (optional)"),
    })),
  },
  async ({ exam_id, grades }) => {
    await api(`/api/instructor/exams/${exam_id}/grading`, { method: "PUT", body: JSON.stringify({ grades }) });
    const correct = grades.filter((g) => g.result === "correct").length;
    const incorrect = grades.filter((g) => g.result === "incorrect").length;
    const partial = grades.filter((g) => g.result === "partial").length;
    return { content: [{ type: "text" as const, text: `Graded: ${grades.length} answers (${correct} correct, ${incorrect} incorrect, ${partial} partial)` }] };
  }
);

server.tool(
  "list_students",
  "List all students who have taken your exams, with exam count, graded count, and average score.",
  {},
  async () => {
    const students = await api<Array<{ studentName: string; examCount: number; gradedExamCount: number; avgScoreRate: number | null; lastSubmittedAt: string | null }>>("/api/instructor/students");
    return { content: [{ type: "text" as const, text: JSON.stringify(students, null, 2) }] };
  }
);

server.tool(
  "get_student_history",
  "Get a student's full exam history: scores, answers, grades, and per-question details. Use for weakness analysis and learning trend tracking.",
  { student_name: z.string().describe("Student name (from list_students)") },
  async ({ student_name }) => {
    const history = await api<{ studentName: string; examCount: number; examResults: Array<{ examId: number; examCode: string; examTitle: string; submittedAt: string | null; totalScore: number; maxScore: number; correctCount: number; incorrectCount: number; questions: Array<{ questionId: number; orderIndex: number; type: string; question: string; code: string | null; correctAnswer: string; maxScore: number; studentAnswer: string | null; score: number | null; result: string | null; comment: string | null }> }> }>(`/api/instructor/students/${encodeURIComponent(student_name)}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
