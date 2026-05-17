import DashboardShell from "../components/DashboardShell";
import { getUserChannelSummary } from "../lib/channels";
import { getCurrentUser } from "../lib/current-user";
import { hasAuthEnv } from "../lib/env";

export default async function Home() {
  const user = await getCurrentUser();
  const summary = user ? await getUserChannelSummary(user.id) : { count: 0, platforms: [] };

  return (
    <DashboardShell
      initialUser={user}
      authConfigured={hasAuthEnv()}
      initialChannelCount={summary.count}
      initialPlatforms={summary.platforms}
    />
  );
}
