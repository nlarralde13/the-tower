import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <PageSurface backgroundImage="/backgrounds/inn-bg.png">
      <AuthGate>
        <Screen title="The Inn" note="A bed, a rumor, a favor owed." />
      </AuthGate>
    </PageSurface>
  );
}
