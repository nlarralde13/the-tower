import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <PageSurface backgroundImage="/backgrounds/traders-bg.png">
      <AuthGate>
        <Screen title="Traders Guild" note="Markets whisper and bite." />
      </AuthGate>
    </PageSurface>
  );
}
