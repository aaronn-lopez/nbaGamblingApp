import Link from "next/link";
import { PropsWithChildren } from "react";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/rankings", label: "Rankings" },
  { href: "/collection", label: "Collection" },
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Admin" }
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="cc-eyebrow">Court Cash HQ</p>
          <h1>NBA cards without the gambling framing</h1>
        </div>
        <nav className="nav-pills" aria-label="Primary">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
