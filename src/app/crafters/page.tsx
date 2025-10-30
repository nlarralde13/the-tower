import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <PageSurface backgroundImage="/backgrounds/crafters-bg.png">
      <AuthGate>
        <Screen title="Crafters Guild" note="Where scraps become relics." />
      </AuthGate>
    </PageSurface>
  );
}
