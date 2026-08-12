import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getGroupForMember, listMembers, MAX_MEMBERS } from "@/lib/groups";
import Logo from "../../../components/Logo";
import LogoutButton from "../../../components/LogoutButton";
import GroupView from "../../../components/GroupView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const group = getGroupForMember(id, user.id);
  if (!group) redirect("/app");

  const members = listMembers(id);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/app" className="flex items-center gap-2">
          <Logo size={32} />
          <span className="text-lg font-semibold">NVC</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <GroupView
        groupId={group.id}
        groupName={group.name}
        members={members}
        currentUserId={user.id}
        maxMembers={MAX_MEMBERS}
      />
    </main>
  );
}
