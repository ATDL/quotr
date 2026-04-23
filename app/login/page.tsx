import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

// Server component — redirects authenticated users before rendering the form.
// This prevents the infinite loop: logged-in user → /login → sees form again.
export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return <LoginForm />;
}
