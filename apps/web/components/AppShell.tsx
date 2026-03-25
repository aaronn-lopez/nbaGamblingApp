'use client';

import Link from "next/link";
import { PropsWithChildren, useEffect, useState } from "react";
import { getSessionEventName, getStoredWalletBalance, isAuthenticated, logout } from "../lib/api";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/rankings", label: "Players" },
  { href: "/collection", label: "Cards" },
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Market" },
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Status" }
];

export function AppShell({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const isAuth = isAuthenticated();
      setAuthenticated(isAuth);
      if (isAuth && typeof window !== 'undefined') {
        setUsername(localStorage.getItem('username'));
        setWalletBalance(getStoredWalletBalance());
      } else {
        setUsername(null);
        setWalletBalance(null);
      }
    };

    checkAuth();

    const sessionEventName = getSessionEventName();
    const handleStorageChange = () => checkAuth();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(sessionEventName, handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(sessionEventName, handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setUsername(null);
    window.location.href = '/login';
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="cc-eyebrow">Court Cash</p>
          <h1>Buy cards, open packs, and keep your balance in view.</h1>
        </div>
        <nav className="nav-pills" aria-label="Primary">
          {authenticated ? (
            <>
              {navItems.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
              <span className="user-info">
                {username}
              </span>
              {walletBalance ? <span className="balance-chip">{walletBalance} CC</span> : null}
              <button onClick={handleLogout} className="logout-btn">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Sign In</Link>
              <Link href="/register">Get Started</Link>
            </>
          )}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
