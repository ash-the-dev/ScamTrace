import {
  createSessionToken,
  passwordsMatch,
  readJsonBody,
  sessionCookieHeader,
  getConsolePassword,
} from "../../utils/consoleAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!getConsolePassword()) {
    return res.status(503).json({
      ok: false,
      error: "Console password not configured (CONSOLE_PASSWORD or ScamTrace_Engine_Key)",
    });
  }

  try {
    const body = await readJsonBody(req);
    const password = body?.password;

    if (!passwordsMatch(password)) {
      return res.status(401).json({ ok: false, error: "Invalid password" });
    }

    const token = createSessionToken();
    res.setHeader("Set-Cookie", sessionCookieHeader(token));
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: String(err.message || err).slice(0, 200),
    });
  }
}
