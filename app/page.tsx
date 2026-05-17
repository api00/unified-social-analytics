import DashboardShell from "../components/DashboardShell";
import { countUserChannels } from "../lib/channels";
import { getCurrentUser } from "../lib/current-user";
import { hasAuthEnv } from "../lib/env";

export default async function Home() {
  const user = await getCurrentUser();
  const initialChannelCount = user ? await countUserChannels(user.id) : 0;

  return (
    <DashboardShell
      initialUser={user}
      authConfigured={hasAuthEnv()}
      initialChannelCount={initialChannelCount}
    />
  );
}
