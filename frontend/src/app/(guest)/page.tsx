import { redirect } from "next/navigation";

export default function LandingPage() {
  const isLoggedIn = false; // will hook into auth later

  if (isLoggedIn) {
    redirect("/core/dashboard");
  }

  return (
    <div className="h-200 pt-10">
        <h1>Hey, This is the landing page (you aren't logged in)</h1>
    </div>
  );
}
