import { test, expect, login, completeProfile, gif } from "./fixtures";

test("signup triggers, onboarding, session persistence and sign-out", async ({ page, accounts }) => {
  const account = await accounts.create();
  const { data: identity, error } = await account.client.from("profiles").select("email,first_name,last_name").single();
  expect(error).toBeNull();
  expect(identity).toEqual({ email: account.email, first_name: null, last_name: null });
  const { data: member } = await account.client.from("member_profiles").select("is_listed").single();
  expect(member?.is_listed).toBe(false);
  await login(page, account);
  await page.goto("/members");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Complete your profile by adding your first and last name.")).toBeVisible();
  await completeProfile(page);
  await page.getByRole("link", { name: "Continue to members" }).click();
  await expect(page).toHaveURL(/\/members$/);
  await expect(page.getByText("A SQL query walks into a bar.", { exact: true })).toBeVisible();
  await expect(page.getByText("PrivateFirst", { exact: true })).toHaveCount(0);
  await expect(page.getByText(account.email, { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Edit your profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("textbox", { name: "First name", exact: true })).toHaveValue("PrivateFirst");
  await page.goto("/members");
  await page.reload();
  await expect(page).toHaveURL(/\/members$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
});

test("text drafts survive navigation, show edited cues, and can be discarded", async ({ page, accounts }) => {
  await login(page, await accounts.create());
  await completeProfile(page, "Saved joke");
  const joke = page.getByRole("textbox", { name: "Favorite joke", exact: true });
  await joke.fill("Unsaved joke");
  await expect(joke).toHaveClass(/input-changed/);
  await page.getByRole("link", { name: "Images", exact: true }).click();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(joke).toHaveValue("Unsaved joke");
  // Client navigation can retain the mounted form; reload exercises sessionStorage recovery.
  await page.reload();
  await expect(joke).toHaveValue("Unsaved joke");
  await expect(page.getByText("Unsaved changes restored.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(joke).toHaveValue("Saved joke");
  await expect(joke).not.toHaveClass(/input-changed/);
  await page.reload();
  await expect(joke).toHaveValue("Saved joke");
});

test("GIF uploads and previous-photo restoration persist through real Storage and SQL", async ({ page, accounts }) => {
  const account = await accounts.create();
  await login(page, account);
  await completeProfile(page);
  async function upload(name: string) {
    await page.getByRole("button", { name: /Change photo/ }).click();
    await page.getByLabel("Upload new photo").setInputFiles({ name, mimeType: "image/gif", buffer: gif });
    await expect(page.getByText("Photo change not saved.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(page.getByText("Photo change not saved.", { exact: false })).not.toBeVisible();
    await expect(page.getByText("Profile saved.", { exact: false })).toBeVisible();
    const { data, error } = await account.client.from("member_profiles").select("current_avatar_path").single();
    expect(error).toBeNull();
    expect(data?.current_avatar_path).toMatch(new RegExp("^" + account.id + "/.*\\.gif$"));
    return data!.current_avatar_path as string;
  }
  const first = await upload("first.gif");
  const second = await upload("second.gif");
  expect(second).not.toBe(first);
  await page.getByRole("button", { name: /Change photo/ }).click();
  await page.getByRole("button", { name: "Use previous photo 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use previous photo 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Photo change not saved.", { exact: false })).not.toBeVisible();
  await page.reload();
  const { data: current } = await account.client.from("member_profiles").select("current_avatar_path").single();
  expect(current?.current_avatar_path).toBe(first);
  await expect.poll(() => page.getByAltText("Your profile photo preview").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const { data: collection } = await account.client.from("profile_photos").select("avatar_path");
  expect(collection?.map(p => p.avatar_path).sort()).toEqual([first, second].sort());
});

test("members see current photos and jokes while private data and old photos remain protected", async ({ page, accounts }) => {
  const a = await accounts.create();
  const b = await accounts.create();
  async function save(account: typeof a, joke: string, path: string | null = null) {
    const { error } = await account.client.rpc("save_my_profile", {
      p_first_name: "PrivateFirst", p_last_name: "PrivateLast", p_favorite_joke: joke,
      p_avatar_path: path, p_avatar_is_upload: Boolean(path),
    });
    expect(error).toBeNull();
  }
  const old = a.id + "/old.gif";
  const current = a.id + "/current.gif";
  for (const path of [old, current]) {
    const { error } = await a.client.storage.from("avatars").upload(path, gif, { contentType: "image/gif" });
    expect(error).toBeNull();
    await save(a, "Member A joke", path);
  }
  await save(b, "Member B joke");
  await login(page, b);
  await page.goto("/members");
  const card = page.locator(".member-card").filter({ hasText: "Member A joke" });
  await expect(card).toBeVisible();
  await expect.poll(() => card.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(a.email, { exact: true })).toHaveCount(0);
  const privateRows = await b.client.from("profiles").select("*").eq("id", a.id);
  expect(privateRows.error).toBeNull(); expect(privateRows.data).toEqual([]);
  const oldPhotos = await b.client.from("profile_photos").select("*").eq("profile_id", a.id);
  expect(oldPhotos.error).toBeNull(); expect(oldPhotos.data).toEqual([]);
  expect((await b.client.storage.from("avatars").createSignedUrl(old, 60)).error).not.toBeNull();
  expect((await b.client.rpc("save_my_profile", {
    p_first_name: "Attempt", p_last_name: "Attempt", p_avatar_path: current, p_avatar_is_upload: false,
  })).error).not.toBeNull();
  expect((await accounts.anonymous.from("member_profiles").select("*")).error).not.toBeNull();
  expect((await b.client.from("profiles").update({ first_name: "Injected" }).eq("id", b.id)).error).not.toBeNull();
});
