"use client";
import Link from "next/link";

export default function MainMenu() {
  const menu = [
    { href: "/climb", label: "Climb the Tower", subtitle: "Ascend. Or don’t." },
    { href: "/traders", label: "Traders Guild", subtitle: "Buy, sell, regret." },
    { href: "/crafters", label: "Crafters Guild", subtitle: "Make useful mistakes." },
    { href: "/inn", label: "The Inn", subtitle: "Save, rest, overhear secrets." },
    { href: "/training", label: "Training", subtitle: "Bruises are temporary. Probably." },
  ];

  return (
    <main className="tower-shell">
      <div className="menu-panel">
        <h2 className="panel-title">Where do you wish to go?</h2>
        <ul className="menu-list">
          {menu.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="menu-link">
                <span className="menu-label">{item.label}</span>
                <span className="menu-sub">{item.subtitle}</span>
                <span className="menu-chev">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
