// src/app/page.tsx
import AuthGate from "@/components/AuthGate";
import MainMenu from "@/components/MainMenu";
import PageSurface from "@/components/PageSurface";

export default function Home() {
  return (
    <PageSurface backgroundImage="/backgrounds/tower-bg.png">
      <AuthGate>
        <MainMenu />
      </AuthGate>
    </PageSurface>
  );
}
