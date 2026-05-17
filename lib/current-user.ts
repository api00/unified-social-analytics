import { headers } from "next/headers";
import { auth } from "./auth";
import { hasDatabaseEnv } from "./env";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!hasDatabaseEnv()) return null;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || "Creator",
      avatarUrl: session.user.image ?? null,
    };
  } catch {
    return null;
  }
}
