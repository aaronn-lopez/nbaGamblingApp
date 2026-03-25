'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { isAuthenticated, loadWebState, WebState } from "../../lib/api";
import { SectionCard } from "@court-cash/ui";
import { formatBalance, formatNotificationLabel } from "../../lib/formatting";

export default function ProfilePage() {
  const [state, setState] = useState<WebState | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const isAuth = isAuthenticated();
    setAuthenticated(isAuth);

    if (!isAuth) {
      router.push("/login");
      return;
    }

    loadWebState({ requireAuth: true })
      .then((data) => {
        setState(data);
        setError("");
      })
      .catch((error) => {
        setState(null);
        setError(error instanceof Error ? error.message : "We couldn't load your profile.");
      });
  }, [router]);

  if (authenticated === null) {
    return (
      <AppShell>
        <div className="loading">Loading your profile...</div>
      </AppShell>
    );
  }

  if (!authenticated) {
    return (
      <AppShell>
        <div className="auth-required">
          <h2>Sign in to see your profile</h2>
          <p>Use your username, then come back here.</p>
        </div>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell>
        <div className="auth-required">
          <h2>We couldn’t load your profile</h2>
          <p>{error || "Please try again in a moment."}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="two-up">
        <SectionCard title={state.profile.displayName} eyebrow={`@${state.profile.username}`}>
          <ul className="plain-list">
            <li>Home city: {state.profile.homeCourt}</li>
            <li>Joined: {new Date(state.profile.joinedAt).toLocaleDateString()}</li>
            <li>Current balance: {formatBalance(state.wallet.balance)}</li>
          </ul>
        </SectionCard>
        <SectionCard title="Updates" eyebrow="What changed lately">
          <div className="listing-stack">
            {state.notifications.map((notification) => (
              <article className="notice-card" key={notification.id}>
                <p className="cc-eyebrow">{formatNotificationLabel(notification.kind)}</p>
                <h3>{notification.title}</h3>
                <p>{notification.body}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
