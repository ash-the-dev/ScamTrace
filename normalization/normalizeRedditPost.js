export function normalizeRedditPost(
    data,
    source,
    scamType
  ) {
    const combinedText = `
      ${data.title || ""}
      ${data.selftext || ""}
    `;
  
    return {
      source,
      source_id: `${source}_${data.id}`,
      title: data.title || "",
      body: data.selftext || "",
      author: data.author || "unknown",
      url: `https://reddit.com${data.permalink}`,
      scam_type: scamType,
  
      keywords: combinedText
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 4)
        .slice(0, 15),
  
      created_at_source: new Date(
        data.created_utc * 1000
      ).toISOString(),
  
      raw_data: data
    };
  }