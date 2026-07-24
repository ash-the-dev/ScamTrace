import axios from "axios";
import { classifyScam } from "../classification/classifyScam.js";
import { normalizeRedditPost } from "../normalization/normalizeRedditPost.js";
import { withSupabaseRetry } from "../utils/supabaseRetry.js";

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
        const contentHtml = tagValue(entry, "content");
        const selftext = stripHtml(contentHtml);
        const authorName = tagValue(entry, "name").replace(/^\/u\//, "");
        const linkMatch = entry.match(
            /<link[^>]*href="([^"]+)"[^>]*rel="alternate"[^>]*>/i
        ) || entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*>/i)
          || entry.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
        const link = linkMatch ? linkMatch[1] : "";
        const idTag = tagValue(entry, "id");
        // Atom id examples: t3_1tfd4zq or https://www.reddit.com/...
        const idFromTag = idTag.match(/t3_([a-z0-9]+)/i)?.[1]
            || link.match(/comments\/([a-z0-9]+)\//i)?.[1]
            || idTag.split("/").filter(Boolean).pop()
            || String(Date.now());
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

async function fetchRedditPosts(source) {
    // Reddit frequently returns 403 for .json listings from datacenter IPs.
    // Atom RSS remains available and is used as the primary feed.
    const rssResponse = await axios.get(source.rssUrl, {
        headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/atom+xml, application/xml, text/xml, */*",
        },
        responseType: "text",
    });

    return {
        posts: parseRedditAtomFeed(String(rssResponse.data)),
        method: "rss",
    };
}

export async function ingestRedditSources(supabase) {
    console.log("Reddit ingestion function started.");
    const sources = [
        {
            name: "reddit_scams",
            jsonUrl: "https://www.reddit.com/r/scams.json",
            rssUrl: "https://www.reddit.com/r/scams/.rss",
        },
        {
            name: "reddit_phishing",
            jsonUrl: "https://www.reddit.com/r/phishing.json",
            rssUrl: "https://www.reddit.com/r/phishing/.rss",
        },
    ];

    for (const source of sources) {
        let recordsSaved = 0;
        let recordsProcessed = 0;

        try {
            const { posts, method } = await fetchRedditPosts(source);
            recordsProcessed = posts.length;
            console.log(
                `${source.name}: fetched ${recordsProcessed} posts via ${method}`
            );

            for (const data of posts) {
                const combinedText = `
          ${data.title || ""}
          ${data.selftext || ""}
        `;

                const scamType = classifyScam(combinedText);

                const record = normalizeRedditPost(
                    data,
                    source.name,
                    scamType
                );

                const { error } = await withSupabaseRetry(
                    () =>
                        supabase.from("scam_reports").upsert(record, {
                            onConflict: "source_id",
                        }),
                    { label: `reddit upsert ${source.name}` }
                );

                if (error) {
                    console.error("Save Error:", error.message);
                } else {
                    recordsSaved++;

                    console.log(
                        "Saved:",
                        source.name,
                        "-",
                        data.title
                    );
                }
            }

            const { error: logError } = await withSupabaseRetry(
                () =>
                    supabase.from("ingestion_logs").insert({
                        source: source.name,
                        records_processed: recordsProcessed,
                        records_saved: recordsSaved,
                        status: "success",
                        message: `Reddit ingestion completed via ${method}`,
                    }),
                { label: `reddit ingestion_logs ${source.name}` }
            );

            if (logError) {
                console.error("Log Save Error:", logError.message);
            } else {
                console.log(
                    `Log saved for ${source.name}: ${recordsSaved}/${recordsProcessed} records saved.`
                );
            }
        } catch (err) {
            console.error(
                `Pipeline Error for ${source.name}:`,
                err.message
            );

            await supabase
                .from("ingestion_logs")
                .insert({
                    source: source.name,
                    records_processed: recordsProcessed,
                    records_saved: recordsSaved,
                    status: "failed",
                    message: err.message,
                });
        }

        // Avoid Reddit rate limits when polling multiple subreddits.
        // Shorter default on Vercel so the cron stays under function maxDuration.
        const delayMs = Number(
            process.env.REDDIT_SOURCE_DELAY_MS ??
                (process.env.VERCEL ? 2000 : 15000)
        );
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}
