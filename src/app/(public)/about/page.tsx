import { ContentPage } from "@/components/layout/content-page";
export const metadata = { title: "About" };
export default function About() {
  return (
    <ContentPage eyebrow="Our story" title="Made for coming together.">
      <p>
        KadiYangu is a digital invitation and event platform. Our vision is to
        make it easier to invite the people who matter and organise memorable
        gatherings.
      </p>
      <p>
        Browse celebration categories and explore free or premium invitation
        designs. You can register, sign in, and access your personal dashboard.
        The card editor, event tools, and guest management will arrive in later
        phases.
      </p>
      <p>
        This early staging release helps us test the platform before those
        features arrive.
      </p>
    </ContentPage>
  );
}
