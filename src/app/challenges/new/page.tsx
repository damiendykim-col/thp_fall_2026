import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// Preserve existing creation links and their login destination.
export default async function NewChallengePage() {
  await requireUser("/challenges/new");
  redirect("/challenges?mode=create");
}
