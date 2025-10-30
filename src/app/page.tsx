// src/app/page.tsx
import TopBar from "@/components/TopBar";
import AuthGate from "@/components/AuthGate";
import MainMenu from "@/components/MainMenu";

export default function Home() {
  return (
    <AuthGate>
      <TopBar />
      <MainMenu />
    </AuthGate>
  );
}
