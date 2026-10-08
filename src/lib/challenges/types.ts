export type Challenge = {
  id: string; own: boolean; status: string; situation: string; image_path: string | null;
  template_url: string | null; closes_at: string | null; closed: boolean; vote: string | null;
  hidden_at?: string | null;
  image_description?: string | null; joke_context?: string | null;
  captions: { id: string; body: string; origin: "human" | "ai" | null; votes: number | null }[];
};
export type ChallengeResult = { error?: string; id?: string };
