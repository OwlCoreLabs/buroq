import AuthScreen from "./feature/auth/auth-screen";
import InboxDashboard from "./feature/dasboard/inbox-dashboard";
import { getCurrentUser, isAccountConfigured } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) return <InboxDashboard username={user.username} />;
  return <AuthScreen firstRun={!isAccountConfigured()} />;
}
