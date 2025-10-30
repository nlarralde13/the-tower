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
    <main className="main">
      <h2 className="title">Where do you wish to go?</h2>
      <ul className="menu">
        {menu.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="menu-item">
              <div className="dot" />
              <div className="labels">
                <span className="label">{item.label}</span>
                <span className="sub">{item.subtitle}</span>
              </div>
              <span className="chev">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
