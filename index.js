import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ingestRedditSources } from "./ingestion/redditIngestion.js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function runPipeline() {
  console.log("Starting ScamTrace pipeline...");

  await ingestRedditSources(supabase);

  console.log("Pipeline complete.");
}

runPipeline();