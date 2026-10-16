import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { getImages } from "@/lib/images";
import ChallengeForm from "./challenge-form";
export const maxDuration = 120;

export default async function NewChallengePage() {
  const { user } = await requireUser("/challenges/new");
  const templates = await getImages();
  return <><SiteHeader /><main className="page-shell account-page"><h1>Create a challenge</h1><ChallengeForm userId={user.id} templates={templates} /></main></>;
}
