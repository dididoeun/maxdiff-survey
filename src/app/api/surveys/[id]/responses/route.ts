import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getAuthenticatedUser, checkSurveyOwnership } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id: surveyId } = await params;
    const body = await req.json();
    const { respondentId, jobRole, round, setBatch, bestItem, worstItem } = body;

    if (!respondentId || round === undefined || !setBatch || !bestItem || !worstItem) {
      return NextResponse.json(
        { error: "모든 필드를 입력해주세요." },
        { status: 400 }
      );
    }

    if (bestItem === worstItem) {
      return NextResponse.json(
        { error: "Best와 Worst에 같은 항목을 선택할 수 없습니다." },
        { status: 400 }
      );
    }

    const db = getDb();
    await db.execute({
      sql: "INSERT INTO responses (surveyId, respondentId, jobRole, round, setBatch, bestItem, worstItem) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [surveyId, respondentId, jobRole || "", round, JSON.stringify(setBatch), bestItem, worstItem],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "응답 저장에 실패했습니다." },
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

    const isOwner = await checkSurveyOwnership(surveyId, user.id);
    if (!isOwner) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM responses WHERE surveyId = ? ORDER BY createdAt",
      args: [surveyId],
    });

    return NextResponse.json(
      result.rows.map((r) => ({
        ...r,
        setBatch: JSON.parse(r.setBatch as string),
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "응답 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
