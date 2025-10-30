import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <PageSurface backgroundImage="/backgrounds/training-bg.png">
      <AuthGate>
        <Screen title="Training" note="Learn fast, survive faster." />
      </AuthGate>
    </PageSurface>
  );
}
