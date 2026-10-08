"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { ChallengeResult } from "@/lib/challenges/types";

export async function reportChallenge(id: string, reason: string): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("report_challenge", { p_challenge: id, p_reason: reason });
  return error ? { error: "Report could not be saved. Check the reason or try again later." } : {};
}
export async function hideChallenge(id: string): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("hide_challenge", { p_challenge: id });
  if (error) return { error: "You cannot hide this challenge." };
  revalidatePath("/challenges", "layout"); revalidatePath("/images"); revalidatePath("/moderation");
  return {};
}
export async function dismissReport(id: string): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("dismiss_challenge_report", { p_report: id });
  revalidatePath("/moderation");
  return error ? { error: "Report could not be dismissed." } : {};
}
export async function approveTemplate(id: string): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("approve_challenge_template", { p_template: id });
  revalidatePath("/moderation");
  return error ? { error: "Template could not be approved." } : {};
}
