import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Files live in private buckets, so links are short-lived signed URLs.
const SIGNED_URL_SECONDS = 60 * 60; // 1 hour
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // re-sign 5 minutes before expiry

const cache = new Map(); // "bucket/path" -> { url, expiresAt }

/** Path for a new upload: inside a folder named after the signed-in user. */
export async function userFilePath(fileName) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return `${user.id}/${fileName}`;
}

/** Signed URLs for several files in one bucket, as { path: url }. */
export async function getSignedUrls(bucket, paths) {
  const now = Date.now();
  const result = {};
  const missing = [];

  for (const path of paths) {
    const hit = cache.get(`${bucket}/${path}`);
    if (hit && hit.expiresAt - REFRESH_MARGIN_MS > now) result[path] = hit.url;
    else missing.push(path);
  }

  if (missing.length) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(missing, SIGNED_URL_SECONDS);
    if (error) throw error;
    const expiresAt = now + SIGNED_URL_SECONDS * 1000;
    for (const item of data) {
      if (item.signedUrl) {
        cache.set(`${bucket}/${item.path}`, { url: item.signedUrl, expiresAt });
        result[item.path] = item.signedUrl;
      }
    }
  }

  return result;
}

/** React hook: signed URLs for the given paths, as { path: url }. */
export function useSignedUrls(bucket, paths) {
  const key = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState({});

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    getSignedUrls(bucket, key.split("|"))
      .then((fresh) => {
        if (!cancelled) setUrls((prev) => ({ ...prev, ...fresh }));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [bucket, key]);

  return urls;
}
