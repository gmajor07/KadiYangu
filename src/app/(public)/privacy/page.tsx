import { ContentPage } from "@/components/layout/content-page";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <ContentPage eyebrow="Staging notice" title="Your privacy matters.">
      <p>
        This is an early test release. Use test information during staging. This
        notice must be completed with the operator’s identity, contact
        information, retention periods, and applicable rights before a public
        launch.
      </p>
      <p>
        The application stores your name, email, optional phone number, password
        hash, account role and status, and account timestamps to provide account
        access. Passwords are hashed, not stored as plain text. Authentication
        cookies maintain your signed-in session.
      </p>
      <p>
        Hashed authentication identifiers and attempt counts help limit abuse.
        The hosting provider may record operational access logs. This phase has
        no advertising, payment processing, or third-party analytics
        integration.
      </p>
      <p>
        Access to account data is restricted to authorised operations. Account
        deletion and privacy requests must be handled by the staging operator
        until a public support process is established.
      </p>
    </ContentPage>
  );
}
