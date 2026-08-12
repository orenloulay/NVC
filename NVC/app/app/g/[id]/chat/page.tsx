import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getGroupForMember } from "@/lib/groups";
import ChatView from "../../../../components/ChatView";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const group = getGroupForMember(id, user.id);
  if (!group) redirect("/app");

  return <ChatView groupId={group.id} groupName={group.name} />;
}
