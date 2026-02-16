import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";

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

    return NextResponse.json({
      ...survey,
      items: JSON.parse(survey.items as string),
      jobRoles: JSON.parse((survey.jobRoles as string) || "[]"),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "설문 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
