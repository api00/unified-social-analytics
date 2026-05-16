import { NextResponse } from "next/server";
import { demoOverview } from "../../../../data/analytics";
import { createSupabaseServiceClient, getAuthenticatedUser } from "../../../../lib/supabase/server";
import { getOverviewForUser } from "../../../../lib/analytics/overview";

export async function GET() {
  const user = await getAuthenticatedUser();
  const supabase = createSupabaseServiceClient();

  if (!supabase || !user) return NextResponse.json(demoOverview);

  const overview = await getOverviewForUser(supabase, user.id);
  return NextResponse.json(overview);
}
