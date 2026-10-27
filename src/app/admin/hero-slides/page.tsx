import { HomepageMediaManager } from "@/components/admin/homepage-media-manager";
export const dynamic="force-dynamic";
export default async function HeroSlides({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}) {
  return <HomepageMediaManager placement="CARD" query={await searchParams}/>;
}
