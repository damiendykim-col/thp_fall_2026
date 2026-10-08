import { test, expect, login } from "./fixtures";
import sharp from "sharp";

test("upload, generate, publish, blind voting, undo, switch and timed reveal", async ({ page, accounts }) => {
  const owner = await accounts.create();
  const voter = await accounts.create();
  await login(page, owner);
  await page.goto("/challenges/new");
  await page.getByLabel("Challenge image").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: await sharp({create:{width:16,height:16,channels:3,background:"#ffe01b"}}).png().toBuffer() });
  await page.getByLabel("Situation / scene description").fill("When the midterm is tomorrow and the weekend was yesterday.");
  await page.getByLabel("Your caption").fill("My syllabus has entered its villain era.");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  const id = page.url().split("/").pop()!;
  // Another user cannot read this draft, its captions, generation prompts or image.
  expect((await voter.client.rpc("read_caption_challenge", { p_challenge: id })).data).toBeNull();
  expect((await voter.client.from("challenge_captions").select("*")).error).toBeTruthy();
  const { data: draft } = await owner.client.rpc("read_caption_challenge", { p_challenge: id });
  expect((await voter.client.storage.from("challenge-images").createSignedUrl(draft.image_path,60)).error).toBeTruthy();
  await page.getByRole("button", { name: "Generate AI opponent" }).click();
  await expect(page.getByRole("button", { name: "Publish for 24 hours" })).toBeVisible();
  expect((await voter.client.from("challenge_generations").select("*").eq("challenge_id",id)).data).toEqual([]);
  expect((await owner.client.from("challenge_generations").select("provider,prompt").eq("challenge_id",id)).data?.[0].provider).toBe("mock");
  await page.getByRole("button", { name: "Publish for 24 hours" }).click();
  await expect(page.getByText("This is your challenge. Creators cannot vote.")).toBeVisible();
  const { data: blind } = await voter.client.rpc("read_caption_challenge", { p_challenge: id });
  expect(blind.captions).toHaveLength(2);
  for (const caption of blind.captions) { expect(caption.origin).toBeNull(); expect(caption.votes).toBeNull(); }
  expect((await owner.client.rpc("vote_caption_challenge", { p_challenge:id,p_caption:blind.captions[0].id })).error).toBeTruthy();
  expect((await voter.client.storage.from("challenge-images").createSignedUrl(draft.image_path,60)).error).toBeNull();
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, voter);
  await page.goto(`/challenges/${id}`);
  await page.getByRole("button", { name: "Upvote", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Undo upvote" })).toBeVisible();
  await page.getByRole("button", { name: "Undo upvote" }).click();
  await expect(page.getByRole("button", { name: "Upvote", exact:true })).toHaveCount(2);
  await page.getByRole("button", { name: "Upvote", exact:true }).first().click();
  await expect(page.getByRole("button", { name: "Undo upvote" })).toBeVisible();
  await page.getByRole("button", { name: "Upvote", exact:true }).click();
  await expect(page.getByRole("button", { name: "Undo upvote" })).toBeEnabled();
  expect((await voter.client.from("challenge_votes").select("*").eq("challenge_id",id)).data).toHaveLength(1);
  // Concurrent explicit votes cannot produce more than one ballot.
  const results = await Promise.all(blind.captions.map((c: { id: string }) => voter.client.rpc("vote_caption_challenge", {p_challenge:id,p_caption:c.id})));
  for (const result of results) expect(result.error).toBeNull();
  expect((await voter.client.from("challenge_votes").select("*").eq("challenge_id",id)).data).toHaveLength(1);
  // Only test admin can advance the deadline; the client cannot modify publication.
  expect((await voter.client.from("challenges").update({closes_at:new Date().toISOString()}).eq("id",id)).error).toBeTruthy();
  const { error } = await accounts.admin.from("challenges").update({closes_at:"2000-01-01T00:00:00.000Z"}).eq("id",id);
  expect(error).toBeNull();
  await page.reload();
  await expect(page.getByText("AI caption", {exact:true})).toBeVisible();
  await expect(page.getByText("Human caption", {exact:true})).toBeVisible();
  await expect(page.getByRole("button", {name:"Upvote",exact:true})).toHaveCount(0);
  expect((await voter.client.rpc("vote_caption_challenge", {p_challenge:id,p_caption:null})).error).toBeTruthy();
  expect((await accounts.anonymous.rpc("read_caption_challenge", {p_challenge:id})).error).toBeTruthy();
});

test("clients cannot forge generation, modify others' drafts or submit invalid images", async ({page,accounts}) => {
  const owner=await accounts.create();
  const other=await accounts.create();
  const {data: templates}=await owner.client.from("images").select("id").limit(1);
  const args={p_owner:owner.id,p_image:null,p_template:templates![0].id,p_situation:"Test scene",p_caption:"Human line"};
  expect((await owner.client.rpc("create_caption_challenge",args)).error).toBeTruthy();
  const {data:id,error}=await accounts.admin.rpc("create_caption_challenge",args);
  expect(error).toBeNull();
  expect((await other.client.rpc("publish_caption_challenge",{p_challenge:id})).error).toBeTruthy();
  expect((await owner.client.rpc("finish_caption_generation",{p_request:id,p_caption:"Forged"})).error).toBeTruthy();
  expect((await owner.client.from("challenge_captions").insert({challenge_id:id,body:"Fake",origin:"ai"})).error).toBeTruthy();
  await login(page,owner);
  await page.goto("/challenges/new");
  await page.getByLabel("Challenge image").setInputFiles({name:"fake.png",mimeType:"image/png",buffer:Buffer.from("not an image")});
  await page.getByLabel("Situation / scene description").fill("A scene");
  await page.getByLabel("Your caption").fill("A caption");
  await page.getByRole("button",{name:"Create draft"}).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("valid, still JPEG");
});

test("generation claims are exclusive, failed attempts retry, and successful drafts cannot regenerate", async ({accounts}) => {
  const owner=await accounts.create();
  const {data:templates}=await owner.client.from("images").select("id").limit(1);
  const {data:id,error}=await accounts.admin.rpc("create_caption_challenge",{p_owner:owner.id,p_image:null,p_template:templates![0].id,p_situation:"A template scene",p_caption:"Human line"});
  expect(error).toBeNull();
  const args={p_owner:owner.id,p_challenge:id,p_provider:"mock",p_model:"test",p_prompt:{user:"scene"}};
  const claims=await Promise.all([accounts.admin.rpc("claim_caption_generation",args),accounts.admin.rpc("claim_caption_generation",args)]);
  expect(claims.filter(x=>!x.error)).toHaveLength(1);
  const request=claims.find(x=>!x.error)!.data;
  expect((await accounts.admin.rpc("finish_caption_generation",{p_request:request,p_caption:null})).error).toBeNull();
  const {data:retry,error:retryError}=await accounts.admin.rpc("claim_caption_generation",args);
  expect(retryError).toBeNull();
  expect((await accounts.admin.rpc("finish_caption_generation",{p_request:retry,p_caption:"AI line"})).error).toBeNull();
  // Retried completion is idempotent, not a second candidate.
  expect((await accounts.admin.rpc("finish_caption_generation",{p_request:retry,p_caption:"Duplicate line"})).error).toBeNull();
  expect((await accounts.admin.rpc("claim_caption_generation",args)).error).toBeTruthy();
  const {data:ready}=await owner.client.rpc("read_caption_challenge",{p_challenge:id});
  expect(ready.captions).toHaveLength(2);
  expect(ready.captions.map((x:{body:string})=>x.body)).toContain("AI line");
  expect((await owner.client.rpc("publish_caption_challenge",{p_challenge:id})).error).toBeNull();
  const {data:first}=await owner.client.rpc("read_caption_challenge",{p_challenge:id});
  expect((await owner.client.rpc("publish_caption_challenge",{p_challenge:id})).error).toBeNull();
  const {data:again}=await owner.client.rpc("read_caption_challenge",{p_challenge:id});
  expect(again.closes_at).toBe(first.closes_at);
});
