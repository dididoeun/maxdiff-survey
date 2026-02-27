import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getAuthenticatedUser, checkSurveyOwnership } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM surveys WHERE id = ?",
      args: [id],
    });

    const survey = result.rows[0];
    if (!survey) {
      return NextResponse.json(
        { error: "설문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const questionsResult = await db.execute({
      sql: "SELECT * FROM questions WHERE surveyId = ? ORDER BY questionOrder",
      args: [id],
    });

    const questions = questionsResult.rows.map((q) => ({
      ...q,
      options: JSON.parse((q.options as string) || "[]"),
      required: Boolean(q.required),
      multipleAnswers: Boolean(q.multipleAnswers),
    }));

    return NextResponse.json({
      ...survey,
      items: JSON.parse(survey.items as string),
      jobRoles: JSON.parse((survey.jobRoles as string) || "[]"),
      questions,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "설문 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    await initDb();
    const { id } = await params;

    const isOwner = await checkSurveyOwnership(id, user.id);
    if (!isOwner) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const db = getDb();

    // 응답 존재 여부 확인
    const responseCount = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM responses WHERE surveyId = ?",
      args: [id],
    });
    if (Number(responseCount.rows[0].cnt) > 0) {
      return NextResponse.json(
        { error: "응답이 존재하는 설문은 수정할 수 없습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, items, setSize, jobRoles, status, questions } = body;

    const surveyStatus = status === "draft" ? "draft" : "published";

    if (!title || !items) {
      return NextResponse.json(
        { error: "제목과 항목이 필요합니다." },
        { status: 400 }
      );
    }

    if (surveyStatus === "published" && items.length < 2) {
      return NextResponse.json(
        { error: "발행하려면 최소 2개 이상의 항목이 필요합니다." },
        { status: 400 }
      );
    }

    await db.execute({
      sql: "UPDATE surveys SET title = ?, items = ?, setSize = ?, jobRoles = ?, status = ? WHERE id = ?",
      args: [title, JSON.stringify(items), setSize || 4, JSON.stringify(jobRoles || []), surveyStatus, id],
    });

    // 기존 questions 삭제 후 새로 INSERT
    await db.execute({
      sql: "DELETE FROM questions WHERE surveyId = ?",
      args: [id],
    });
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        await db.execute({
          sql: "INSERT INTO questions (id, surveyId, type, title, options, required, multipleAnswers, questionOrder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          args: [
            q.id || uuidv4(),
            id,
            q.type,
            q.title || "",
            JSON.stringify(q.options || []),
            q.required ? 1 : 0,
            q.multipleAnswers ? 1 : 0,
            q.order ?? 0,
          ],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "설문 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    await initDb();
    const { id } = await params;

    const isOwner = await checkSurveyOwnership(id, user.id);
    if (!isOwner) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const db = getDb();

    await db.execute({ sql: "DELETE FROM survey_admins WHERE surveyId = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM general_responses WHERE surveyId = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM questions WHERE surveyId = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM responses WHERE surveyId = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM surveys WHERE id = ?", args: [id] });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "설문 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
