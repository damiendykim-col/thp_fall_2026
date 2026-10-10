import { test, expect, login, approveForTest } from "./fixtures";
import sharp from "sharp";

test("upload, generate, publish, blind voting, undo, switch and timed reveal", async ({ page, accounts }) => {
  const owner = await accounts.create();
  const voter = await accounts.create();
  await login(page, owner);
  await page.goto("/challenges/new");
  const image = await sharp({create:{width:16,height:16,channels:3,background:"#ffe01b"}}).png().toBuffer();
  // Exercise the exact file limit through multipart Server Actions, not only the decoder.
  const boundaryImage = Buffer.concat([image, Buffer.alloc(3 * 1024 * 1024 - image.length)]);
  await page.getByLabel("Challenge image").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: boundaryImage });
  await page.getByText("Review image understanding", { exact: true }).click();
  await expect(page.getByLabel("Image description", { exact: true })).toHaveValue("A yellow square fills the image.");
  await page.getByLabel("Your caption").fill("My syllabus has entered its villain era.");
  await expect(page.getByRole("button", { name: "Create draft", exact: true })).toBeDisabled();
  await page.getByLabel("I confirm this image description").check();
  await page.getByLabel("Add context for the joke (optional)").fill("When the midterm is tomorrow and the weekend was yesterday.");
  await page.getByLabel("Your caption").fill("My syllabus has entered its villain era.");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  const id = page.url().split("/").pop()!;
  const { data: reviewed } = await owner.client.from("challenge_images").select("*").single();
  expect(reviewed.suggested_description).toBe("A yellow square fills the image.");
  expect(reviewed.confirmed_description).toBe(reviewed.suggested_description);
  expect(reviewed.description_source).toBe("accepted");
  expect(reviewed.prompt.version).toBe("image-description-v1");
  expect((await voter.client.from("challenge_images").select("*")).data).toEqual([]);
  expect((await owner.client.from("challenge_images").update({ suggested_description: "Forged" }).eq("id", reviewed.id)).error).toBeTruthy();
  // Another user cannot read this draft, its captions, generation prompts or image.
  expect((await voter.client.rpc("read_caption_challenge", { p_challenge: id })).data).toBeNull();
  expect((await voter.client.from("challenge_captions").select("*")).error).toBeTruthy();
  const { data: draft } = await owner.client.rpc("read_caption_challenge", { p_challenge: id });
  expect((await voter.client.storage.from("challenge-images").createSignedUrl(draft.image_path,60)).error).toBeTruthy();
  await page.getByRole("button", { name: "Generate AI opponent" }).click();
  // Wait for either outcome, then surface the actual alert instead of timing
  // out on a publish button that cannot appear after a generation failure.
  const generationError = page.getByRole("main").getByRole("alert");
  await expect(page.getByRole("button", { name: "Publish for 24 hours" }).or(generationError)).toBeVisible();
  expect(await generationError.allTextContents(), "Generation returned an error").toEqual([]);
  await expect(page.getByRole("button", { name: "Publish for 24 hours" })).toBeVisible();
  expect((await voter.client.from("challenge_generations").select("*").eq("challenge_id",id)).data).toEqual([]);
  expect((await owner.client.from("challenge_generations").select("provider,prompt").eq("challenge_id",id)).data?.[0].provider).toBe("mock");
  await page.getByRole("button", { name: "Publish for 24 hours" }).click();
  await expect(page.getByText("Your challenge · Waiting for the community’s votes.")).toBeVisible();
  await page.goto("/challenges");
  const card = page.locator(`.challenge-feed-card[href="/challenges/${id}"]`);
  await expect(card.getByRole("img")).toHaveAttribute("alt", "A yellow square fills the image.");
  await expect(card.getByText("A yellow square fills the image.", { exact: true })).toHaveCount(0);
  await expect(card.getByRole("heading")).toHaveText("When the midterm is tomorrow and the weekend was yesterday.");
  await expect(card.getByText("Yours", { exact: true })).toBeVisible();
  await expect(card.getByText("View your challenge", { exact: false })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${id}$`));
  const { data: blind } = await voter.client.rpc("read_caption_challenge", { p_challenge: id });
  expect(blind.captions).toHaveLength(2);
  for (const caption of blind.captions) { expect(caption.origin).toBeNull(); expect(caption.votes).toBeNull(); }
  expect((await owner.client.rpc("vote_caption_challenge", { p_challenge:id,p_caption:blind.captions[0].id })).error).toBeTruthy();
  expect((await voter.client.storage.from("challenge-images").createSignedUrl(draft.image_path,60)).error).toBeNull();
  await page.getByText("Account", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, voter);
  await page.goto(`/challenges/${id}`);
  await page.getByRole("button", { name: "Upvote", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Undo upvote" })).toBeVisible();
  await page.goto("/challenges");
  const votedCard = page.locator(`.challenge-feed-card[href="/challenges/${id}"]`);
  await expect(votedCard.getByText("Voted", { exact: false })).toBeVisible();
  await expect(votedCard.getByText("Review your vote", { exact: false })).toBeVisible();
  await votedCard.click();
  await page.getByRole("button", { name: "Undo upvote" }).click();
  await expect(page.getByRole("button", { name: "Upvote", exact:true })).toHaveCount(2);
  await page.goto("/challenges");
  await expect(votedCard.getByText("Voted", { exact: false })).toHaveCount(0);
  await expect(votedCard.getByText("Pick the funnier caption", { exact: false })).toBeVisible();
  await votedCard.click();
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

  await expect(page.getByRole("main").getByRole("alert")).toContainText("valid, still JPEG");
});

test("generation claims are exclusive, failed attempts retry, and successful drafts cannot regenerate", async ({accounts}) => {
  const owner=await accounts.create();
  const {data:templates}=await owner.client.from("images").select("id").limit(1);
  const {data:id,error}=await accounts.admin.rpc("create_caption_challenge",{p_owner:owner.id,p_image:null,p_template:templates![0].id,p_situation:"A template scene",p_caption:"Human line"});
  expect(error).toBeNull();
  const args={p_owner:owner.id,p_challenge:id,p_provider:"mock",p_model:"test",p_prompt:{user:"scene"}};
  const claims=await Promise.all([accounts.admin.rpc("claim_caption_generation",args),accounts.admin.rpc("claim_caption_generation",args)]);
  expect(claims.filter(x=>!x.error), JSON.stringify(claims.map(x=>x.error))).toHaveLength(1);
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
  expect((await owner.client.rpc("publish_caption_challenge",{p_challenge:id})).error).toBeTruthy();
  await approveForTest(accounts.admin, owner.id, id);
  expect((await owner.client.rpc("publish_caption_challenge",{p_challenge:id})).error).toBeNull();
  const {data:first}=await owner.client.rpc("read_caption_challenge",{p_challenge:id});
  expect((await owner.client.rpc("publish_caption_challenge",{p_challenge:id})).error).toBeNull();
  const {data:again}=await owner.client.rpc("read_caption_challenge",{p_challenge:id});
  expect(again.closes_at).toBe(first.closes_at);
});

test("image review preserves the AI original, supports edits/replacement and reuses analysis", async ({ page, accounts }) => {
  const owner = await accounts.create();
  await login(page, owner);
  const buffer = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#ffe01b" } }).png().toBuffer();
  let analysisStarted: string | null = null;
  for (const mode of ["edited", "replaced"]) {
    await page.goto("/challenges/new");
    await page.getByLabel("Challenge image").setInputFiles({ name: "review.png", mimeType: "image/png", buffer });
    await page.getByText("Review image understanding", { exact: true }).click();
    await expect(page.getByLabel("Image description", { exact: true })).toHaveValue("A yellow square fills the image.");
    await page.getByLabel("I confirm this image description").check();
    if (mode === "replaced") await page.getByRole("button", { name: "Write my own description" }).click();
    await page.getByLabel("Image description", { exact: true }).fill(`My ${mode} visual description.`);
    await expect(page.getByLabel("I confirm this image description")).not.toBeChecked();
    await page.getByLabel("Your caption").fill(`My ${mode} joke.`);
    await page.getByLabel("I confirm this image description").check();
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
    const { data: image } = await owner.client.from("challenge_images").select("*").single();
    expect(image.suggested_description).toBe("A yellow square fills the image.");
    expect(image.confirmed_description).toBe(`My ${mode} visual description.`);
    expect(image.description_source).toBe(mode);
    if (analysisStarted) expect(image.description_started_at).toBe(analysisStarted);
    analysisStarted = image.description_started_at;
    const { data: challenge } = await owner.client.from("challenges").select("*").eq("id", page.url().split("/").pop()!).single();
    expect(challenge.image_description).toBe(`My ${mode} visual description.`);
    expect(challenge.joke_context).toBeNull();
    expect(challenge.description_source).toBe(mode);
  }
  expect((await owner.client.from("challenges").select("id")).data).toHaveLength(2);
  const { data: first } = await owner.client.from("challenges").select("image_description").eq("description_source", "edited").single();
  expect(first?.image_description).toBe("My edited visual description.");
});

test("template descriptions need confirmation and review RPCs enforce identity and idempotency", async ({ page, accounts }) => {
  const owner = await accounts.create();
  const other = await accounts.create();
  await login(page, owner);
  await page.goto("/challenges/new");
  await page.getByLabel("Image source").selectOption("template");
  const { data: templates } = await owner.client.from("images").select("id").limit(1);
  await page.getByLabel("Gallery template").selectOption(templates![0].id);
  await page.getByText("Review image understanding", { exact: true }).click();
  await page.getByLabel("Image description", { exact: true }).fill("A template's visible scene.");
  await page.getByLabel("I confirm this image description").check();
  await page.getByLabel("Your caption").fill("Human answer not shared with Gemini.");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  const id = page.url().split("/").pop()!;
  await page.getByRole("button", { name: "Generate AI opponent" }).click();
  await expect(page.getByRole("button", { name: "Publish for 24 hours" })).toBeVisible();
  const { data: generated } = await owner.client.from("challenge_generations").select("prompt").eq("challenge_id", id).single();
  expect(generated?.prompt.user).toContain("Image description: A template's visible scene.");
  expect(generated?.prompt.user).toContain("Joke context: None supplied.");
  expect(JSON.stringify(generated?.prompt)).not.toContain("Human answer not shared");
  const { data: record } = await owner.client.from("challenges").select("review_submission").eq("id", id).single();
  if (!record) throw new Error("Reviewed challenge missing");
  const args = { p_owner: owner.id, p_image_id: null, p_template: templates![0].id, p_description: "Scene", p_context: "", p_caption: "Caption", p_confirmed: true, p_manual: false, p_submission: record.review_submission };
  expect((await accounts.admin.rpc("create_reviewed_challenge", args)).data).toBe(id);
  expect((await owner.client.rpc("create_reviewed_challenge", args)).error).toBeTruthy();
  expect((await other.client.rpc("reserve_challenge_image", { p_owner: owner.id, p_hash: "a".repeat(64) })).error).toBeTruthy();
  const { randomUUID } = await import("node:crypto");
  expect((await accounts.admin.rpc("create_reviewed_challenge", { ...args, p_submission: randomUUID(), p_confirmed: false })).error).toBeTruthy();
  expect((await accounts.admin.rpc("create_reviewed_challenge", { ...args, p_submission: randomUUID(), p_description: " " })).error).toBeTruthy();
  const { data: image } = await accounts.admin.rpc("reserve_challenge_image", { p_owner: owner.id, p_hash: "a".repeat(64) });
  expect((await accounts.admin.rpc("create_reviewed_challenge", { ...args, p_owner: other.id, p_image_id: image.id, p_template: null, p_submission: randomUUID() })).error).toBeTruthy();
  const reservations = await Promise.all(Array.from({ length: 12 }, (_, i) => accounts.admin.rpc("reserve_challenge_image", { p_owner: owner.id, p_hash: (i + 1).toString(16).padStart(64, "0") })));
  expect(reservations.filter(r => !r.error)).toHaveLength(9); // One image was already reserved.
});

test("an image with failed analysis can be manually described and used without another provider call", async ({ page, accounts }) => {
  const owner = await accounts.create();
  const { createHash } = await import("node:crypto");
  const input = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#ffe01b" } }).png().toBuffer();
  const normalized = await sharp(input).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const { data: image, error } = await accounts.admin.rpc("reserve_challenge_image", { p_owner: owner.id, p_hash: createHash("sha256").update(normalized).digest("hex") });
  expect(error).toBeNull();
  expect((await accounts.admin.storage.from("challenge-images").upload(image.storage_path, normalized, { contentType: "image/jpeg" })).error).toBeNull();
  expect((await accounts.admin.from("challenge_images").update({ upload_ready: true, description_status: "failed" }).eq("id", image.id)).error).toBeNull();
  await login(page, owner);
  await page.goto("/challenges/new");
  await page.getByLabel("Challenge image").setInputFiles({ name: "manual.png", mimeType: "image/png", buffer: input });
  await expect(page.getByText("A description could not be suggested. Write your own to continue.")).toBeVisible();
  await page.getByText("Review image understanding", { exact: true }).click();
  await page.getByLabel("Image description", { exact: true }).fill("A yellow square.");
  await page.getByLabel("I confirm this image description").check();
  await page.getByLabel("Your caption").fill("A square deal.");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  const { data: saved } = await owner.client.from("challenge_images").select("*").single();
  expect(saved.id).toBe(image.id);
  expect(saved.suggested_description).toBeNull();
  expect(saved.description_source).toBe("manual");
  expect(saved.description_started_at).toBeNull();
});
