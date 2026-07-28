/**
 * Postgres rejects a single UPSERT that lists the same onConflict key twice:
 * "ON CONFLICT DO UPDATE command cannot affect row a second time"
 */
export function dedupeBySourceId(records) {
  const map = new Map();
  let dropped = 0;
  for (const record of records) {
    const key = record?.source_id;
    if (!key) {
      dropped += 1;
      continue;
    }
    if (map.has(key)) dropped += 1;
    map.set(key, record);
  }
  return { records: [...map.values()], dropped };
}
