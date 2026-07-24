import { isConsoleAuthorized } from "../../utils/consoleAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isConsoleAuthorized(req)) {
    return res.status(401).json({ ok: false, authenticated: false });
  }

  return res.status(200).json({ ok: true, authenticated: true });
}
