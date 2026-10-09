import { test, expect, login } from "./fixtures";

test("only closed, unique winners appear with correct attribution and original challenge links", async ({page,accounts}) => {
  const owner=await accounts.create();
  const voter=await accounts.create();
  const secondVoter=await accounts.create();
  const {data:images}=await accounts.admin.from("images").select("id,image_url").limit(1);
  const ids: Record<string,string>={};
  for (const kind of ["human","ai","tie","zero","open","draft"]) {
    const {data:c,error}=await accounts.admin.from("challenges").insert({creator_id:owner.id,template_id:images![0].id,template_url:images![0].image_url,situation:`Winner eligibility ${kind}`,status:kind==="draft"?"ready":"published",published_at:new Date().toISOString(),closes_at:new Date(Date.now()+86400000).toISOString()}).select("id").single();
    expect(error).toBeNull(); ids[kind]=c!.id;
    const {data:captions,error:captionError}=await accounts.admin.from("challenge_captions").insert(["human","ai"].map(origin=>({challenge_id:c!.id,origin,body:`${kind} challenge ${origin} caption`}))).select("id,origin");
    expect(captionError).toBeNull();
    if (!["zero","draft"].includes(kind)) {
      const chosen=captions!.find(x=>x.origin===(kind==="ai"?"ai":"human"))!;
      expect((await voter.client.rpc("vote_caption_challenge",{p_challenge:c!.id,p_caption:chosen.id})).error).toBeNull();
      if (kind==="tie") expect((await secondVoter.client.rpc("vote_caption_challenge",{p_challenge:c!.id,p_caption:captions!.find(x=>x.origin==="ai")!.id})).error).toBeNull();
    }
    if (kind!=="open") expect((await accounts.admin.from("challenges").update({closes_at:"2000-01-01T00:00:00.000Z"}).eq("id",c!.id)).error).toBeNull();
  }
  const {data:winners,error}=await voter.client.rpc("list_challenge_winners");
  expect(error).toBeNull();
  const ours=winners.filter((w:{challenge_id:string})=>Object.values(ids).includes(w.challenge_id));
  expect(ours).toHaveLength(2);
  expect(ours.find((w:{challenge_id:string})=>w.challenge_id===ids.human)).toMatchObject({origin:"human",caption:"human challenge human caption",upvotes:1});
  expect(ours.find((w:{challenge_id:string})=>w.challenge_id===ids.ai)).toMatchObject({origin:"ai",caption:"ai challenge ai caption",upvotes:1});
  expect((await accounts.anonymous.rpc("list_challenge_winners")).error).toBeTruthy();
  await login(page,voter);
  await page.goto("/images");
  await expect(page.getByRole("link",{name:"Results",exact:true})).toHaveAttribute("aria-current","page");
  await expect(page.getByText("human challenge human caption",{exact:true})).toBeVisible();
  await expect(page.getByText("ai challenge ai caption",{exact:true})).toBeVisible();
  await expect(page.getByText("Human-written",{exact:true})).toBeVisible();
  await expect(page.getByText("AI-generated",{exact:true})).toBeVisible();
  await page.locator(`a[href="/challenges/${ids.human}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${ids.human}$`));
  await page.goto("/images?view=templates");
  await expect(page.getByRole("group",{name:"Image layout"})).toBeVisible();
});

test("anonymous visitors can browse templates but winners keep the challenge audience", async ({page}) => {
  await page.goto("/images");
  await expect(page).toHaveURL(/\/challenges\?view=results$/);
  await expect(page.getByRole("region", {name:"Example challenge"})).toBeVisible();
  await page.goto("/images?view=templates");
  await expect(page.locator(".image-grid img")).toHaveCount(2);
});
