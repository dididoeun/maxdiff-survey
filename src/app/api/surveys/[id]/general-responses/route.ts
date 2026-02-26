import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getAuthenticatedUser, checkSurveyAccess } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id: surveyId } = await params;
    const body = await req.json();
    const { respondentId, answers } = body;

    if (!respondentId || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "respondentId와 answers가 필요합니다." },
        { status: 400 }
      );
    }

    const db = getDb();
    for (const a of answers) {
      const answer = Array.isArray(a.answer)
        ? JSON.stringify(a.answer)
        : String(a.answer ?? "");
      await db.execute({
        sql: "INSERT INTO general_responses (surveyId, questionId, respondentId, answer) VALUES (?, ?, ?, ?)",
        args: [surveyId, a.questionId, respondentId, answer],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "일반 문항 응답 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    await initDb();
    const { id: surveyId } = await params;

    const hasAccess = await checkSurveyAccess(surveyId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `SELECT gr.id, gr.questionId, gr.respondentId, gr.answer, gr.createdAt,
                   q.title, q.type, q.options
            FROM general_responses gr
            JOIN questions q ON gr.questionId = q.id
            WHERE gr.surveyId = ?
            ORDER BY q.questionOrder, gr.respondentId`,
      args: [surveyId],
    });

    return NextResponse.json(
      result.rows.map((r) => ({
        ...r,
        options: JSON.parse((r.options as string) || "[]"),
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "일반 문항 응답 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
