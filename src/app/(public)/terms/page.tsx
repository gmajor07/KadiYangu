import { ContentPage } from "@/components/layout/content-page";
export const metadata = { title: "Terms" };
export default function Terms() {
  return (
    <ContentPage eyebrow="Staging notice" title="A foundation for fair use.">
      <p>
        This release is for early testing of KadiYangu account access. Features
        and availability may change, and test data may be removed. Do not rely
        on this staging service for live events.
      </p>
      <p>
        Keep your login details private. Do not impersonate others, misuse the
        service, or attempt to access accounts and areas you are not authorised
        to use.
      </p>
      <p>
        No purchases, paid invitations, or event services are offered in this
        phase. These draft staging terms need operator details, support
        contacts, and legal review before public launch.
      </p>
    </ContentPage>
  );
}
