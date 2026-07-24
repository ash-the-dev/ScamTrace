import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ingestRedditSources } from "../ingestion/redditIngestion.js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

await ingestRedditSources(supabase);

const { count } = await supabase
  .from("scam_reports")
  .select("*", { count: "exact", head: true });

const { data: logs } = await supabase
  .from("ingestion_logs")
  .select("source,status,records_saved,message,created_at")
  .order("created_at", { ascending: false })
  .limit(4);

console.log("Total scam_reports:", count);
console.log(JSON.stringify(logs, null, 2));
