import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    await initDb();
    const body = await req.json();
    const { title, description, items, setSize, jobRoles, status, questions, maxdiffTitle, bestLabel, worstLabel } = body;

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

    const id = uuidv4().slice(0, 8);
    const db = getDb();

    await db.execute({
      sql: "INSERT INTO surveys (id, title, description, items, setSize, jobRoles, userId, status, maxdiffTitle, bestLabel, worstLabel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, title, description || "", JSON.stringify(items), setSize || 4, JSON.stringify(jobRoles || []), user.id, surveyStatus, maxdiffTitle || "", bestLabel || "", worstLabel || ""],
    });

    // 일반 문항 저장
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

    return NextResponse.json({ id });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "설문 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    await initDb();
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT s.*, COUNT(r.id) as responseCount,
              CASE WHEN s.userId = ? THEN 1 ELSE 0 END as isOwner
            FROM surveys s
            LEFT JOIN responses r ON s.id = r.surveyId
            LEFT JOIN survey_admins sa ON s.id = sa.surveyId AND sa.userId = ?
            WHERE s.userId = ? OR sa.userId = ?
            GROUP BY s.id
            ORDER BY s.createdAt DESC`,
      args: [user.id, user.id, user.id, user.id],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "설문 목록 조회 실패" }, { status: 500 });
  }
}
