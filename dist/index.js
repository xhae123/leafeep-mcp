#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import QRCode from "qrcode";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
const API_BASE = process.env.LEAFEEP_API_URL ?? "https://api.leafeep.com";
const FRONTEND_URL = process.env.LEAFEEP_FRONTEND_URL ?? "https://leafeep.com";
const API_KEY = process.env.LEAFEEP_API_KEY ?? "";
const TOKEN_DIR = join(homedir(), ".leafeep");
const TOKEN_FILE = join(TOKEN_DIR, "token");
function loadToken() {
    try {
        if (existsSync(TOKEN_FILE))
            return readFileSync(TOKEN_FILE, "utf-8").trim();
    }
    catch { }
    return null;
}
function saveToken(token) {
    mkdirSync(TOKEN_DIR, { recursive: true });
    writeFileSync(TOKEN_FILE, token, "utf-8");
}
let authToken = loadToken();
function getAuthHeaders() {
    if (API_KEY)
        return { "X-API-Key": API_KEY };
    if (authToken)
        return { Authorization: `Bearer ${authToken}` };
    throw new Error("Not logged in. Run the 'setup' tool first, then paste your token with the 'verify' tool.");
}
async function api(path, options = {}) {
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
    return res.json();
}
const server = new McpServer({
    name: "leafeep",
    version: "0.3.0",
    description: "Quiz distribution & grading for coding instructors. You can: create exams, share links with students, grade submissions, track student performance, and analyze results — all from Claude.",
});
server.tool("setup", "Get the login link for Leafeep. After logging in, copy the token shown on the page and use the 'verify' tool to connect.", {}, async () => {
    if (API_KEY) {
        return { content: [{ type: "text", text: "Already authenticated with API key." }] };
    }
    if (authToken) {
        try {
            await api("/api/auth/me");
            return { content: [{ type: "text", text: "Already logged in." }] };
        }
        catch {
            authToken = null;
        }
    }
    const loginUrl = `${FRONTEND_URL}/mcp-setup`;
    return {
        content: [{
                type: "text",
                text: [
                    `Open this link and log in with Google:`,
                    ``,
                    loginUrl,
                    ``,
                    `After login, a token will be shown on the page.`,
                    `Copy it and run: verify <token>`,
                ].join("\n"),
            }],
    };
});
server.tool("verify", "Paste the token from the login page to connect your account. Usage: verify <token>", {
    token: z.string().describe("The token shown on the login page after Google sign-in"),
}, async ({ token }) => {
    authToken = token;
    try {
        await api("/api/auth/me");
        saveToken(token);
        return { content: [{ type: "text", text: "✓ Connected! You can now use all Leafeep tools." }] };
    }
    catch {
        authToken = null;
        return { content: [{ type: "text", text: "✗ Invalid token. Please try logging in again." }] };
    }
});
server.tool("create_exam", "Create a question set and generate a student link + QR code.", {
    title: z.string().describe("Set title"),
    questions: z.array(z.object({
        type: z.enum(["multiple_choice", "short_answer", "long_answer"]).describe("Question type"),
        question: z.string().describe("Question text"),
        code: z.string().optional().describe("Code block (optional)"),
        choices: z.array(z.string()).optional().describe("Choices (required for multiple_choice)"),
        answer: z.string().describe("Correct answer"),
        score: z.number().describe("Points"),
    })),
}, async ({ title, questions }) => {
    const questionSet = await api("/api/instructor/question-sets", {
        method: "POST",
        body: JSON.stringify({ title, questions }),
    });
    const exam = await api(`/api/instructor/question-sets/${questionSet.id}/exams`, { method: "POST" });
    const studentUrl = `${FRONTEND_URL}/s/${exam.code}`;
    const qr = await QRCode.toString(studentUrl, { type: "utf8", errorCorrectionLevel: "L" });
    return {
        content: [{
                type: "text",
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
});
server.tool("list_exams", "List all your question sets.", {}, async () => {
    const sets = await api("/api/instructor/question-sets");
    if (sets.length === 0)
        return { content: [{ type: "text", text: "No question sets yet." }] };
    const lines = sets.map((s) => `- [${s.id}] ${s.title} (${s.questionCount} questions, ${s.createdAt.slice(0, 10)})`);
    return { content: [{ type: "text", text: [`Question sets (${sets.length}):`, "", ...lines].join("\n") }] };
});
server.tool("get_results", "Get full exam data: submissions, answers, grading, and statistics.", { exam_id: z.number().describe("Exam ID") }, async ({ exam_id }) => {
    const exam = await api(`/api/instructor/exams/${exam_id}`);
    const submissions = await api(`/api/instructor/exams/${exam_id}/submissions`);
    let grading = null;
    try {
        grading = await api(`/api/instructor/exams/${exam_id}/grading`);
    }
    catch { }
    let results = null;
    try {
        results = await api(`/api/instructor/exams/${exam_id}/results`);
    }
    catch { }
    const data = {
        exam: { id: exam.id, code: exam.code, title: exam.questionSetTitle, status: exam.status, totalSubmissions: exam.totalSubmissions, submittedCount: exam.submittedCount, createdAt: exam.createdAt, closedAt: exam.closedAt },
        submissions: submissions.map((s) => ({ id: s.id, studentName: s.studentName, status: s.status, submittedAt: s.submittedAt, answers: s.answers })),
        grading: grading ? grading.questions.map((q) => ({ questionId: q.questionId, question: q.question, correctAnswer: q.correctAnswer, maxScore: q.score, studentAnswers: q.studentAnswers.map((sa) => ({ studentName: sa.studentName, answerText: sa.answerText, grade: sa.grade ? { score: sa.grade.score, result: sa.grade.result, comment: sa.grade.comment } : null })) })) : null,
        results: results ? { students: results.students, questionStats: results.questionStats } : null,
    };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("close_exam", "Close an exam (lock submissions).", { exam_id: z.number().describe("Exam ID") }, async ({ exam_id }) => {
    await api(`/api/instructor/exams/${exam_id}/close`, { method: "PUT" });
    return { content: [{ type: "text", text: "Exam closed." }] };
});
server.tool("grade_exam", "Grade student submissions. Use answerId from get_results.", {
    exam_id: z.number().describe("Exam ID"),
    grades: z.array(z.object({
        answerId: z.number().describe("Answer ID"),
        result: z.enum(["correct", "incorrect", "partial"]).describe("Grade result"),
        score: z.number().describe("Score"),
        comment: z.string().optional().describe("Comment (optional)"),
    })),
}, async ({ exam_id, grades }) => {
    await api(`/api/instructor/exams/${exam_id}/grading`, { method: "PUT", body: JSON.stringify({ grades }) });
    const c = grades.filter((g) => g.result === "correct").length;
    const i = grades.filter((g) => g.result === "incorrect").length;
    const p = grades.filter((g) => g.result === "partial").length;
    return { content: [{ type: "text", text: `Graded ${grades.length} answers (${c} correct, ${i} incorrect, ${p} partial)` }] };
});
server.tool("bulk_create_review_questions", "Bulk create OX review questions for the review pool. Each question needs a statement, correctAnswer (true/false), and tags (from ConceptTag).", {
    questions: z.array(z.object({
        statement: z.string().describe("OX statement (e.g. 'x²+5x+6=0 의 근은 x=-2, x=-3 이다')"),
        correctAnswer: z.boolean().describe("true if the statement is correct, false otherwise"),
        tags: z.array(z.string()).describe("Concept tags from the tag pool (e.g. ['quadratic_equations', 'factoring'])"),
    })),
}, async ({ questions }) => {
    const result = await api("/api/instructor/review-questions/bulk", { method: "POST", body: JSON.stringify({ questions }) });
    return {
        content: [{
                type: "text",
                text: `Created ${result.created} review questions (${result.skipped} skipped)${result.errors.length > 0 ? `\nErrors:\n${result.errors.join("\n")}` : ""}`,
            }],
    };
});
server.tool("get_review_pool_stats", "Get statistics about the review question pool coverage.", {}, async () => {
    const stats = await api("/api/instructor/review-questions/stats");
    return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
});
server.tool("list_students", "List all students with scores.", {}, async () => {
    const students = await api("/api/instructor/students");
    return { content: [{ type: "text", text: JSON.stringify(students, null, 2) }] };
});
server.tool("get_student_history", "Get a student's full exam history for weakness analysis.", { student_name: z.string().describe("Student name") }, async ({ student_name }) => {
    const history = await api(`/api/instructor/students/${encodeURIComponent(student_name)}`);
    return { content: [{ type: "text", text: JSON.stringify(history, null, 2) }] };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
