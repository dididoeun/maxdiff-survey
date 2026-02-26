import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function checkSurveyOwnership(
  surveyId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT userId FROM surveys WHERE id = ?",
    args: [surveyId],
  });
  if (result.rows.length === 0) return false;
  return result.rows[0].userId === userId;
}

export async function checkSurveyAccess(
  surveyId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT 1 FROM surveys WHERE id = ? AND userId = ?
          UNION
          SELECT 1 FROM survey_admins WHERE surveyId = ? AND userId = ?`,
    args: [surveyId, userId, surveyId, userId],
  });
  return result.rows.length > 0;
}
