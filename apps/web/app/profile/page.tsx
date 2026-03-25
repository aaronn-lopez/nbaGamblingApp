import { AppShell } from "../../components/AppShell";
import { loadWebState } from "../../lib/api";
import { SectionCard } from "@court-cash/ui";

export default async function ProfilePage() {
  const state = await loadWebState();

  return (
    <AppShell>
      <div className="two-up">
        <SectionCard title={state.profile.displayName} eyebrow={`@${state.profile.username}`}>
          <ul className="plain-list">
            <li>Home court: {state.profile.homeCourt}</li>
            <li>Joined: {new Date(state.profile.joinedAt).toLocaleDateString()}</li>
            <li>Current balance: {state.wallet.balance} Court Cash</li>
          </ul>
        </SectionCard>
        <SectionCard title="Notification Center" eyebrow="Unread updates">
          <div className="listing-stack">
            {state.notifications.map((notification) => (
              <article className="notice-card" key={notification.id}>
                <p className="cc-eyebrow">{notification.kind.replaceAll("_", " ")}</p>
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
