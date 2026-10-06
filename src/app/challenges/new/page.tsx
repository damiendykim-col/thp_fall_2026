import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { getImages } from "@/lib/images";
import ChallengeForm from "./challenge-form";
export default async function NewChallengePage() {
  await requireUser();
  const templates = await getImages();
  return <><SiteHeader /><main className="page-shell account-page"><h1>Create a challenge</h1><p className="account-intro">You and AI. One image. Let the captions speak for themselves.</p><ChallengeForm templates={templates} /></main></>;
}
