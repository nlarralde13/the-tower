import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <PageSurface backgroundImage="/backgrounds/climb-bg.png">
      <AuthGate>
        <Screen title="Climb the Tower" note="Floor 1 awaits." />
      </AuthGate>
    </PageSurface>
  );
}
