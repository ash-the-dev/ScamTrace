import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { classifyScam } from "../classification/classifyScam.js";
import { normalizeRedditPost } from "../normalization/normalizeRedditPost.js";

dotenv.config();

const USER_AGENT =
  "script:ScamTrace:1.0 (by /u/scamtrace; contact: contact@scamtrace.io)";

function decodeHtmlEntities(text = "") {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripHtml(html = "") {
  return decodeHtmlEntities(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block, tag) {
  const match = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
  );
  return match ? match[1].trim() : "";
}

function parseRedditAtomFeed(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(
    (m) => m[1]
  );

  return entries.map((entry) => {
    const title = decodeHtmlEntities(tagValue(entry, "title"));
    const selftext = stripHtml(tagValue(entry, "content"));
    const authorName = tagValue(entry, "name").replace(/^\/u\//, "");
    const linkMatch =
      entry.match(/<link[^>]*href="([^"]+)"[^>]*rel="alternate"[^>]*>/i) ||
      entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*>/i) ||
      entry.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
    const link = linkMatch ? linkMatch[1] : "";
    const idTag = tagValue(entry, "id");
    const idFromTag =
      idTag.match(/t3_([a-z0-9]+)/i)?.[1] ||
      link.match(/comments\/([a-z0-9]+)\//i)?.[1] ||
      idTag.split("/").filter(Boolean).pop() ||
      String(Date.now());
    const updated = tagValue(entry, "updated");
    const createdUtc = updated
      ? Math.floor(new Date(updated).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const permalink = link
      ? link.replace(/^https?:\/\/(www\.)?reddit\.com/, "")
      : `/comments/${idFromTag}/`;

    return {
      id: idFromTag,
      title,
      selftext,
      author: authorName || "unknown",
      permalink,
      created_utc: createdUtc,
      url: link,
    };
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const response = await axios.get("https://www.reddit.com/r/phishing/.rss", {
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/atom+xml, application/xml, text/xml, */*",
  },
  responseType: "text",
});

const posts = parseRedditAtomFeed(String(response.data));
console.log(`fetched ${posts.length} phishing posts`);

let saved = 0;
for (const data of posts) {
  const scamType = classifyScam(`${data.title || ""} ${data.selftext || ""}`);
  const record = normalizeRedditPost(data, "reddit_phishing", scamType);
  const { error } = await supabase
    .from("scam_reports")
    .upsert(record, { onConflict: "source_id" });
  if (error) console.error("Save Error:", error.message);
  else {
    saved++;
    console.log("Saved:", data.title);
  }
}

await supabase.from("ingestion_logs").insert({
  source: "reddit_phishing",
  records_processed: posts.length,
  records_saved: saved,
  status: "success",
  message: "Reddit ingestion completed via rss",
});

const { count } = await supabase
  .from("scam_reports")
  .select("*", { count: "exact", head: true });

console.log(`saved ${saved}/${posts.length}; total scam_reports=${count}`);
