import NextAuth from "next-auth";
import { getDb, initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      await initDb();
      const db = getDb();

      // Upsert user
      const existing = await db.execute({
        sql: "SELECT id FROM users WHERE email = ?",
        args: [user.email],
      });

      let userId: string;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id as string;
        await db.execute({
          sql: "UPDATE users SET name = ?, image = ? WHERE id = ?",
          args: [user.name || null, user.image || null, userId],
        });
      } else {
        userId = uuidv4();
        await db.execute({
          sql: "INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)",
          args: [userId, user.name || null, user.email, user.image || null],
        });
      }

      // Upsert account
      const existingAccount = await db.execute({
        sql: "SELECT id FROM accounts WHERE provider = ? AND providerAccountId = ?",
        args: [account.provider, account.providerAccountId],
      });

      if (existingAccount.rows.length === 0) {
        await db.execute({
          sql: "INSERT INTO accounts (id, userId, provider, providerAccountId) VALUES (?, ?, ?, ?)",
          args: [uuidv4(), userId, account.provider, account.providerAccountId],
        });
      }

      return true;
    },
    async jwt({ token, trigger }) {
      if (trigger === "signIn" || !token.userId) {
        if (token.email) {
          await initDb();
          const db = getDb();
          const result = await db.execute({
            sql: "SELECT id FROM users WHERE email = ?",
            args: [token.email],
          });
          if (result.rows.length > 0) {
            token.userId = result.rows[0].id as string;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
