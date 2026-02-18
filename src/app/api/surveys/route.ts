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
    const { title, items, setSize, jobRoles, status } = body;

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
      sql: "INSERT INTO surveys (id, title, items, setSize, jobRoles, userId, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [id, title, JSON.stringify(items), setSize || 4, JSON.stringify(jobRoles || []), user.id, surveyStatus],
    });

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
      sql: `SELECT s.*, COUNT(r.id) as responseCount
            FROM surveys s
            LEFT JOIN responses r ON s.id = r.surveyId
            WHERE s.userId = ?
            GROUP BY s.id
            ORDER BY s.createdAt DESC`,
      args: [user.id],
    });
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "설문 목록 조회 실패" }, { status: 500 });
  }
}
