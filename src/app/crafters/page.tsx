import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundImage: 'url("/backgrounds/crafters-bg.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <AuthGate>
        <Screen title="Crafters Guild" note="Where scraps become relics." />
      </AuthGate>
    </div>
  );
}
