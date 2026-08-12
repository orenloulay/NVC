import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import Logo from "../components/Logo";
import LogoutButton from "../components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="text-lg font-semibold">NVC</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <div className="mt-10">
        <h1 className="text-2xl font-semibold">Your topics</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Groups and conversations are coming next. You’re signed in and verified.
        </p>
      </div>
    </main>
  );
}
