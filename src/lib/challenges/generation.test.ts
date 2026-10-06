/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
import { captionPrompt, generateCaption, generationConfig, validateCaption } from "./generation";
const original = process.env;
afterEach(() => { process.env = original; jest.restoreAllMocks(); });
test("mock generation cannot be enabled on a deployment", () => {
  process.env = { ...original, LLM_PROVIDER:"mock", NODE_ENV:"production", E2E_AUTH_ENABLED:"true", NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:55421", VERCEL:"1" };
  expect(generationConfig).toThrow("isolated local tests");
});
test("prompts record image representation without including a human answer", () => {
  const prompt = captionPrompt("Exam week", "user/file.jpg");
  expect(prompt.representation).toBe("normalized_jpeg");
  expect(prompt.imagePath).toBe("user/file.jpg");
  expect(captionPrompt("Exam week",null).user).toContain("have not viewed its frames");
});
test("invalid and oversized model captions are rejected", () => {
  expect(() => validateCaption(" ")).toThrow();
  expect(() => validateCaption("x".repeat(281))).toThrow();
  expect(() => validateCaption({caption:"text"})).toThrow();
  expect(validateCaption("  A joke. ")).toBe("A joke.");
});
test("Gemini request uses server credentials, actual image bytes and validates completion", async () => {
  process.env = {...original,GEMINI_API_KEY:"unit-test-key"};
  const fetchMock = jest.spyOn(global,"fetch").mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{thought:true,text:"hidden reasoning"},{text:"A caption."}]}}]})));
  const prompt=captionPrompt("Exam week","user/image.jpg");
  expect(await generateCaption({provider:"gemini",model:"test-model"},prompt,Buffer.from("image"))).toBe("A caption.");
  const [,request]=fetchMock.mock.calls[0];
  const body=JSON.parse(request!.body as string);
  expect(body.contents[0].parts[1].inlineData.data).toBe(Buffer.from("image").toString("base64"));
  expect(request!.headers).toHaveProperty("x-goog-api-key","unit-test-key");
  expect(request!.body).not.toContain("unit-test-key");
});
test("quota errors do not disclose provider response bodies", async () => {
  jest.spyOn(global,"fetch").mockResolvedValue(new Response("private diagnostic",{status:429}));
  await expect(generateCaption({provider:"gemini",model:"test"},captionPrompt("scene",null))).rejects.toThrow("quota");
});
test("blocked or truncated responses cannot be published as captions", async () => {
  jest.spyOn(global,"fetch").mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:"MAX_TOKENS",content:{parts:[{text:"unfinished"}]}}]})));
  await expect(generateCaption({provider:"gemini",model:"test"},captionPrompt("scene",null))).rejects.toThrow("could not complete");
});
test("real generation fails clearly when configuration is missing", () => {
  process.env = {...original, LLM_PROVIDER:"gemini",GEMINI_API_KEY:""};
  expect(generationConfig).toThrow("not configured");
});
