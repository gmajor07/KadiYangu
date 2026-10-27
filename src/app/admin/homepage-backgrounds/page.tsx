import { HomepageMediaManager } from "@/components/admin/homepage-media-manager";
export const dynamic="force-dynamic";
export default async function HomepageBackgrounds({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}) {
  return <HomepageMediaManager placement="BACKGROUND" query={await searchParams}/>;
}
