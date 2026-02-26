import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getAuthenticatedUser, checkSurveyOwnership } from "@/lib/auth-helpers";

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
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: `SELECT sa.id, sa.userId, u.name, u.email, u.image, sa.createdAt
            FROM survey_admins sa
            JOIN users u ON sa.userId = u.id
            WHERE sa.surveyId = ?
            ORDER BY sa.createdAt ASC`,
      args: [surveyId],
    });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "공동 관리자 조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
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
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });
    }

    const db = getDb();

    // 해당 이메일 사용자 조회
    const userResult = await db.execute({
      sql: "SELECT id, name, email FROM users WHERE email = ?",
      args: [email],
    });
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "해당 이메일로 가입된 사용자가 없습니다." }, { status: 404 });
    }

    const targetUser = userResult.rows[0];

    // 본인 이메일 확인
    if (targetUser.id === user.id) {
      return NextResponse.json({ error: "본인을 공동 관리자로 추가할 수 없습니다." }, { status: 400 });
    }

    // 이미 공동 관리자인지 확인
    const existing = await db.execute({
      sql: "SELECT id FROM survey_admins WHERE surveyId = ? AND userId = ?",
      args: [surveyId, targetUser.id],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "이미 공동 관리자로 등록된 사용자입니다." }, { status: 400 });
    }

    const id = uuidv4();
    await db.execute({
      sql: "INSERT INTO survey_admins (id, surveyId, userId) VALUES (?, ?, ?)",
      args: [id, surveyId, targetUser.id],
    });

    return NextResponse.json({ success: true, userId: targetUser.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "공동 관리자 추가에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
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
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    }

    const db = getDb();
    await db.execute({
      sql: "DELETE FROM survey_admins WHERE surveyId = ? AND userId = ?",
      args: [surveyId, userId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "공동 관리자 제거에 실패했습니다." }, { status: 500 });
  }
}
