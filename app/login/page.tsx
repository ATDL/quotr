import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

// Server component — redirects authenticated users before rendering the form.
// Also reads ?mode=signup so deep-links from pricing CTAs land on sign-up.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: { mode?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const initialMode =
    searchParams.mode === "signup" ? "sign-up" : "sign-in";

  return <LoginForm initialMode={initialMode} />;
}
