import { notFound } from "next/navigation";
import { isTestAuthEnabled } from "@/lib/test-auth-config";
import { requireUser } from "@/lib/auth";
import SiteHeader from "@/components/site-header";
import GifStoryboard from "./storyboard";

export default async function GifExperimentPage() {
  if (!isTestAuthEnabled()) notFound();
  await requireUser();
  return <><SiteHeader /><main className="page-shell account-page"><h1>Review the moments</h1><p className="account-intro">Local GIF experiment. Nothing is saved, published, or sent to AI.</p><GifStoryboard /></main></>;
}
