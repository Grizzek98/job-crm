import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapedJob {
  company_name: string | null;
  company_url: string | null;
  position_name: string | null;
  position_type: string | null;
  location: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_type: string | null;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  travel_requirements: string | null;
  url_listing: string | null;
  url_application: string | null;
  posted_at: string | null;
}

// ─── Salary parsing ───────────────────────────────────────────────────────────

function parseSalary(text: string): { min: number | null; max: number | null; type: string | null } {
  if (!text) return { min: null, max: null, type: null };

  const isHourly = /\$[\d,.]+\s*(?:\/\s*hr|per\s*hour|hourly)/i.test(text) ||
    /\bhr\b|\bhour\b|\bhourly\b/i.test(text);
  const isSalary = /\$[\d,.]+[kK]\b|\bsalar/i.test(text) ||
    /\$[\d,.]+\s*(?:\/\s*yr|per\s*year|annually)/i.test(text);

  // Match patterns like $80,000 - $120,000 or $80k-$120k or $25/hr
  const rangeMatch = text.match(/\$\s*([\d,]+\.?\d*)\s*[kK]?\s*[-–—to]+\s*\$?\s*([\d,]+\.?\d*)\s*[kK]?/i);
  const singleMatch = text.match(/\$\s*([\d,]+\.?\d*)\s*[kK]?/i);

  let min: number | null = null;
  let max: number | null = null;

  if (rangeMatch) {
    let v1 = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let v2 = parseFloat(rangeMatch[2].replace(/,/g, ""));
    if (/k/i.test(rangeMatch[0])) {
      if (v1 < 1000) v1 *= 1000;
      if (v2 < 1000) v2 *= 1000;
    }
    min = v1;
    max = v2;
  } else if (singleMatch) {
    let v = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (/k/i.test(singleMatch[0]) && v < 1000) v *= 1000;
    min = v;
  }

  const payType = isHourly ? "hourly" : (isSalary || (min && min > 500)) ? "salary" : null;

  return { min, max, type: payType };
}

// ─── Job type detection ───────────────────────────────────────────────────────

function detectJobType(text: string): string | null {
  const lower = text.toLowerCase();
  if (/full[- ]time|full time/.test(lower)) return "full_time";
  if (/part[- ]time|part time/.test(lower)) return "part_time";
  if (/\bcontract\b/.test(lower)) return "contract";
  if (/\binternship\b|\bintern\b/.test(lower)) return "internship";
  if (/\btemporary\b|\btemp\b/.test(lower)) return "temporary";
  return null;
}

// ─── Bot-challenge detection ──────────────────────────────────────────────────

function isBlockedPage(text: string): boolean {
  const lower = text.toLowerCase();
  // Cloudflare challenge signatures
  if (/just a moment/i.test(text) && (/cloudflare/i.test(text) || /ray id/i.test(text) || /additional verification required/i.test(text))) return true;
  // Generic CAPTCHA / bot walls
  if (/enable javascript and cookies to continue/i.test(text)) return true;
  if (/verifying you are human/i.test(text)) return true;
  if (/access denied/i.test(text) && lower.includes("robot")) return true;
  return false;
}

// ─── Text extraction helpers ──────────────────────────────────────────────────

function extractBetween(text: string, startPatterns: string[], endPatterns: string[], maxLength = 5000): string | null {
  for (const startPattern of startPatterns) {
    const startRe = new RegExp(startPattern, "i");
    const startMatch = text.match(startRe);
    if (!startMatch) continue;

    const startIdx = (startMatch.index ?? 0) + startMatch[0].length;
    const remaining = text.slice(startIdx);

    let endIdx = remaining.length;
    for (const endPattern of endPatterns) {
      const endRe = new RegExp(endPattern, "i");
      const endMatch = remaining.match(endRe);
      if (endMatch && (endMatch.index ?? remaining.length) < endIdx) {
        endIdx = endMatch.index ?? endIdx;
      }
    }

    const extracted = remaining.slice(0, Math.min(endIdx, maxLength)).trim();
    if (extracted.length > 30) return extracted;
  }
  return null;
}

function cleanText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

// ─── Board-specific parsers ───────────────────────────────────────────────────

function parseLinkedIn(text: string, url: string): Partial<ScrapedJob> {
  // LinkedIn structured data parsing
  const titleMatch = text.match(/"jobTitle"\s*:\s*"([^"]+)"/i) ||
    text.match(/class="[^"]*job-title[^"]*"[^>]*>([^<]+)</i);
  const companyMatch = text.match(/"hiringOrganization"[^}]*"name"\s*:\s*"([^"]+)"/i) ||
    text.match(/class="[^"]*company-name[^"]*"[^>]*>([^<]+)</i);

  return {
    position_name: titleMatch?.[1]?.trim() ?? null,
    company_name: companyMatch?.[1]?.trim() ?? null,
    url_listing: url,
  };
}

function parseGreenhouse(text: string, url: string): Partial<ScrapedJob> {
  const titleMatch = text.match(/<h1[^>]*class="[^"]*app-title[^"]*"[^>]*>([^<]+)</i) ||
    text.match(/"title"\s*:\s*"([^"]+)"/i);
  const companyMatch = text.match(/<div[^>]*class="[^"]*company-name[^"]*"[^>]*>([^<]+)</i);

  return {
    position_name: titleMatch?.[1]?.trim() ?? null,
    company_name: companyMatch?.[1]?.trim() ?? null,
    url_listing: url,
  };
}

function parseLever(text: string, url: string): Partial<ScrapedJob> {
  const titleMatch = text.match(/<h2[^>]*>([^<]+)<\/h2>/i) ||
    text.match(/"title"\s*:\s*"([^"]+)"/i);
  const companyMatch = url.match(/jobs\.lever\.co\/([^/]+)/i);

  return {
    position_name: titleMatch?.[1]?.trim() ?? null,
    company_name: companyMatch?.[1]?.replace(/-/g, " ") ?? null,
    url_listing: url,
  };
}

// ─── Generic parser ───────────────────────────────────────────────────────────

function parseGeneric(rawHtml: string, text: string, url: string): Partial<ScrapedJob> {
  const result: Partial<ScrapedJob> = { url_listing: url };

  // Try JSON-LD structured data first
  const jsonLdMatch = rawHtml.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      const job = Array.isArray(ld) ? ld.find((x) => x["@type"] === "JobPosting") : ld;
      if (job && job["@type"] === "JobPosting") {
        result.position_name = job.title ?? null;
        result.company_name = job.hiringOrganization?.name ?? null;
        result.company_url = job.hiringOrganization?.sameAs ?? null;
        result.location = job.jobLocation?.address?.addressLocality
          ? `${job.jobLocation.address.addressLocality}, ${job.jobLocation.address.addressRegion ?? ""}`.trim().replace(/,\s*$/, "")
          : (job.jobLocation?.address?.addressRegion ?? null);
        result.description = job.description ? cleanText(job.description).slice(0, 5000) : null;
        result.posted_at = job.datePosted ?? null;

        if (job.baseSalary) {
          const sal = job.baseSalary;
          const unit = sal.unitText?.toLowerCase();
          result.pay_type = unit === "hour" ? "hourly" : "salary";
          result.pay_min = sal.value?.minValue ?? sal.value ?? null;
          result.pay_max = sal.value?.maxValue ?? null;
        }

        if (result.position_name) return result;
      }
    } catch {
      // JSON-LD parsing failed, continue
    }
  }

  // Meta tags
  const ogTitle = rawHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1];
  const twitterTitle = rawHtml.match(/<meta[^>]*name="twitter:title"[^>]*content="([^"]+)"/i)?.[1];
  const metaTitle = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

  result.position_name = ogTitle?.trim() || twitterTitle?.trim() || null;

  if (!result.position_name && metaTitle) {
    // Title often has format "Job Title | Company Name | Site"
    const parts = metaTitle.split(/[|\-–]/);
    result.position_name = parts[0]?.trim() || null;
    if (!result.company_name && parts[1]) {
      result.company_name = parts[1].trim();
    }
  }

  // Try to find location in text
  const locationMatch = text.match(/(?:location|where|based|office)\s*:?\s*([^\n]+)/i) ||
    text.match(/\b(remote|hybrid|on-site|onsite)\b/i);
  result.location = locationMatch?.[1]?.trim().slice(0, 100) ?? null;

  // Salary from text
  const salarySection = text.slice(0, 3000);
  const salaryMatch = salarySection.match(/\$[\d,]+(?:\.\d+)?(?:\s*[kK])?\s*[-–—to]+\s*\$[\d,]+(?:\.\d+)?(?:\s*[kK])?|\$[\d,]+(?:\.\d+)?(?:\s*[kK])?(?:\s*\/?\s*(?:hr|hour|yr|year))?/i);
  if (salaryMatch) {
    const parsed = parseSalary(salarySection);
    result.pay_min = parsed.min;
    result.pay_max = parsed.max;
    result.pay_type = parsed.type;
  }

  // Job type from text
  result.position_type = detectJobType(text.slice(0, 2000));

  // Description section
  result.description = extractBetween(
    text,
    ["(?:job )?description", "about (?:the )?(?:role|job|position)", "what you.ll do", "overview"],
    ["requirements?", "qualifications?", "what you.ll need", "what we.re looking for", "responsibilities"],
    5000,
  ) ?? text.slice(0, 3000);

  // Requirements section
  result.requirements = extractBetween(
    text,
    ["requirements?", "qualifications?", "what you.ll need", "what we.re looking for", "what you bring"],
    ["benefits?", "what we offer", "about us", "about the company", "perks?", "compensation"],
    3000,
  );

  // Benefits section
  result.benefits = extractBetween(
    text,
    ["benefits?", "what we offer", "perks?", "total rewards?", "compensation and benefits?"],
    ["about us", "about the company", "how to apply", "apply now"],
    2000,
  );

  return result;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parsePostedDate(text: string): string | null {
  const patterns = [
    /posted\s*(?:on\s*)?([\w\s,]+\d{4})/i,
    /date\s*posted\s*:?\s*([\w\s,]+\d{4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = new Date(match[1]);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    }
  }
  return null;
}

// ─── Text-paste parser ───────────────────────────────────────────────────────
// Parses raw pasted job description text (no fetch needed).

function parseFromText(rawText: string): Partial<ScrapedJob> {
  const result: Partial<ScrapedJob> = {};

  // Normalize line endings and strip known preamble lines
  const fullText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/^full job description\s*\n+/i, "")
    .replace(/^job details\s*\n+/i, "")
    .replace(/^here.s how the job details[^\n]*\n+/i, "")
    .trim();

  // ── Strip the Indeed "Job details" metadata block ─────────────────────────
  // When copying from an Indeed job page you get alternating key/value lines
  // at the top before the real description:
  //   Pay              Job type        Work setting
  //   $110k–$150k      Full-time       Remote
  // We skip these so company/position/description patterns see the actual text.
  const METADATA_KEY = /^(pay|job types?|work setting|schedule|experience level|education|license|location type)\s*$/i;
  const lines = fullText.split("\n");
  let bodyStart = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "") { i++; continue; }
    if (METADATA_KEY.test(line)) {
      i++; // skip key line
      // skip value line(s) — non-empty lines that aren't another metadata key
      while (i < lines.length && lines[i].trim() !== "" && !METADATA_KEY.test(lines[i].trim())) i++;
      bodyStart = i;
    } else {
      break; // first non-metadata line = start of real content
    }
  }
  const bodyText = lines.slice(bodyStart).join("\n").trim();

  // ── LinkedIn structured header detection ──────────────────────────────────
  // LinkedIn pastes follow "CompanyName\n\nPositionName\n\nCity, ST · N time ago".
  // The optional "Company logo for, X.\n" preamble uses a single \n so it doesn't
  // disturb the \n\n pattern below.
  const linkedInHeaderMatch = fullText.match(
    /([^\n]+)\n\n([^\n]+)\n\n([^\n·]+(?:,\s*[A-Z]{2,3})?)\s*·\s*\d+\s*(?:minute|hour|day|week|month)s?\s*ago/i,
  );

  // ── Company name ──────────────────────────────────────────────────────────
  const logoLineMatch  = fullText.match(/^Company logo for,\s*(.+?)\.?\s*$/im);
  const joinMatch      = bodyText.match(/join the ([A-Za-z][A-Za-z0-9 &'.\-]+?) team\b/i);
  const hiringMatch    = bodyText.match(/\b([A-Za-z][A-Za-z0-9 &'.\-]+?) (?:is|are) (?:looking for|hiring|seeking)\b/i);
  result.company_name  = (
    logoLineMatch?.[1] ??
    linkedInHeaderMatch?.[1] ??
    joinMatch?.[1] ??
    hiringMatch?.[1]
  )?.trim().slice(0, 100) ?? null;

  // ── Position name ─────────────────────────────────────────────────────────
  const lookingMatch = bodyText.match(
    /(?:looking for|seeking|hiring)(?: an?| a \w+(?:\s+\w+)?)?\s+([A-Za-z][A-Za-z0-9 \-\/&]+?)(?:\s+to\s+|\s+who\s+|[.!])/i,
  );
  result.position_name = (linkedInHeaderMatch?.[2] ?? lookingMatch?.[1])?.trim().slice(0, 200) ?? null;

  // ── Top-of-page heuristic (last resort) ───────────────────────────────────
  // Most job listings put title and company as bare headings in the first few
  // lines — no context words, just standalone text. When the patterns above
  // didn't find one or both fields, scan those lines and classify them.
  if (!result.company_name || !result.position_name) {
    // Words that strongly suggest a line is a job title
    const TITLE_WORDS = /\b(manager|director|engineer|developer|analyst|coordinator|designer|lead|senior|junior|associate|vp|vice\s*president|chief|officer|specialist|consultant|architect|supervisor|head|president|executive|representative|technician|administrator|assistant|intern|clerk|accountant|recruiter|nurse|therapist|teacher|instructor|writer|editor|scientist|researcher|advisor|programmer|strategist|planner|liaison|operator|mechanic|driver|chef|cook|custodian|buyer|estimator|dispatcher)\b/i;

    // Lines to skip — LinkedIn UI noise, metadata, job-type labels, location hints
    const SKIP_LINE = /^(company logo for|easy apply|save|promoted|about the job|use ai|get ai|show match|tailor|help me stand out|retry premium|full-?time|part-?time|contract|temporary|internship|remote|on-?site|hybrid)/i;
    const LOCATION_LINE = /\b(remote|hybrid|on-?site|in-?person)\b|[A-Z][a-z]+,\s*[A-Z]{2}\b|·|\d+\s*(?:hour|day|week|month)s?\s*ago|\d+\s*applicants?/i;

    const topLines = fullText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) =>
        l.length > 1 &&
        l.length < 80 &&
        !SKIP_LINE.test(l) &&
        !LOCATION_LINE.test(l),
      )
      .slice(0, 5);

    if (topLines.length >= 2) {
      const titleIdx = topLines.findIndex((l) => TITLE_WORDS.test(l));
      if (titleIdx >= 0) {
        // Classify by keyword — one line is clearly a job title
        if (!result.position_name) result.position_name = topLines[titleIdx].slice(0, 200);
        const compIdx = titleIdx === 0 ? 1 : 0;
        if (!result.company_name && !TITLE_WORDS.test(topLines[compIdx])) {
          result.company_name = topLines[compIdx].slice(0, 100);
        }
      } else {
        // No title keywords — assume LinkedIn order: first line = company, second = title
        if (!result.company_name)  result.company_name  = topLines[0].slice(0, 100);
        if (!result.position_name) result.position_name = topLines[1].slice(0, 200);
      }
    } else if (topLines.length === 1 && !result.position_name) {
      result.position_name = topLines[0].slice(0, 200);
    }
  }

  // ── Description ───────────────────────────────────────────────────────────
  // "About the job" is LinkedIn's section header before real content; start
  // the description there to skip all LinkedIn UI noise above it.
  const aboutJobMatch  = bodyText.match(/^About the job\s*\n/im);
  const descBodyStart  = aboutJobMatch ? (aboutJobMatch.index ?? 0) + aboutJobMatch[0].length : 0;
  const descBody       = bodyText.slice(descBodyStart).trim();

  const firstSectionMatch = descBody.match(
    /^(benefits?|responsibilities|qualifications?|requirements?|qualification requirements?|essential duties|skills\s*(?:&|and)\s*experience|what you.?ll do|what we offer|about us|compensation|about the role)\s*[:\n]/im,
  );
  const descEnd = firstSectionMatch?.index ?? descBody.length;
  result.description = descBody.slice(0, descEnd).trim().slice(0, 5000) || null;

  // ── Benefits (from body text) ─────────────────────────────────────────────
  result.benefits = extractBetween(
    bodyText,
    ["benefits?:", "what we offer:", "perks?:"],
    ["responsibilities:", "qualifications?:", "requirements?:", "\\bnote\\b"],
    2000,
  );

  // ── Requirements / Qualifications (from body text) ────────────────────────
  result.requirements = extractBetween(
    bodyText,
    ["qualifications?:", "requirements?:", "skills\\s*(?:&|and)\\s*experience:", "what you.ll need:", "what we.re looking for:", "what you bring:"],
    ["benefits?:", "what we offer:", "responsibilities:", "\\bnote\\b"],
    3000,
  );

  // ── Pay: from fullText (metadata block has "Pay\n$value" format) ──────────
  // Handle both "Pay\n$value" (Indeed newline format) and "Pay: $value" (inline)
  const payNextLine = fullText.match(/^pay\s*\n([^\n]+)/im);
  const payInline = fullText.match(/^pay\s*:\s*(.+)$/im);
  const paySource = payNextLine?.[1] ?? payInline?.[1] ?? null;
  if (paySource) {
    const parsed = parseSalary(paySource);
    result.pay_min = parsed.min;
    result.pay_max = parsed.max;
    result.pay_type = parsed.type;
  }
  if (!result.pay_min) {
    const parsed = parseSalary(fullText);
    result.pay_min = parsed.min;
    result.pay_max = parsed.max;
    result.pay_type = result.pay_type ?? parsed.type;
  }

  // ── Location: "Work setting\nRemote" or "Work location\nRemote" ───────────
  const workSettingMatch = fullText.match(/^work\s+(?:setting|location)\s*\n([^\n]+)/im);
  const locInline = fullText.match(/^(?:work\s+)?location\s*:\s*(.+)$/im);
  result.location = (workSettingMatch?.[1] ?? locInline?.[1] ?? linkedInHeaderMatch?.[3])?.trim().slice(0, 100) ?? null;
  if (!result.location) {
    const remoteMatch = fullText.match(/\b(remote|hybrid|on-?site|in-?person)\b/i);
    result.location = remoteMatch?.[0]?.trim() ?? null;
  }

  // ── Job type: "Job type\nFull-time" or free-text scan ────────────────────
  const jobTypeNextLine = fullText.match(/^job\s+type\s*\n([^\n]+)/im);
  const jobTypeInline = fullText.match(/^job\s+type\s*:\s*(.+)$/im);
  const jobTypeSource = jobTypeNextLine?.[1] ?? jobTypeInline?.[1] ?? null;
  result.position_type = jobTypeSource
    ? detectJobType(jobTypeSource)
    : detectJobType(fullText.slice(0, 2000));

  return result;
}

// ─── Main fetch + parse ───────────────────────────────────────────────────────

async function fetchAndParse(url: string): Promise<Partial<ScrapedJob>> {
  // Indeed uses Cloudflare bot protection that blocks all server-side fetches.
  // Neither direct fetch nor Jina AI can bypass it — fail fast with a useful message.
  if (/indeed\.com/i.test(url)) {
    throw new Error("Indeed blocks automated scraping. Open the listing, click 'Apply on company site', and paste that URL here instead.");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rawHtml = await response.text();
  const text = cleanText(rawHtml);
  if (isBlockedPage(text)) throw new Error("Site returned a bot-challenge page — could not extract job data.");

  const lower = url.toLowerCase();
  let result: Partial<ScrapedJob>;

  if (lower.includes("linkedin.com")) {
    result = parseLinkedIn(text, url);
  } else if (lower.includes("greenhouse.io") || lower.includes("boards.greenhouse")) {
    result = parseGreenhouse(text, url);
  } else if (lower.includes("lever.co")) {
    result = parseLever(text, url);
  } else {
    result = parseGeneric(rawHtml, text, url);
  }

  // Fill in gaps from generic parsing
  if (!result.position_type && text) {
    result.position_type = detectJobType(text.slice(0, 2000));
  }
  if (!result.posted_at && text) {
    result.posted_at = parsePostedDate(text.slice(0, 1000));
  }
  if (!result.pay_min && text) {
    const parsed = parseSalary(text.slice(0, 3000));
    result.pay_min = parsed.min;
    result.pay_max = parsed.max;
    result.pay_type = result.pay_type ?? parsed.type;
  }

  return result;
}

async function fetchViaJina(url: string): Promise<Partial<ScrapedJob>> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const response = await fetch(jinaUrl, {
    headers: {
      "Accept": "text/plain",
      "User-Agent": "Mozilla/5.0",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`Jina HTTP ${response.status}`);
  const text = await response.text();
  if (isBlockedPage(text)) throw new Error("Site returned a bot-challenge page — could not extract job data.");

  // Jina returns markdown-ish text — run generic extraction on it
  const result: Partial<ScrapedJob> = { url_listing: url };

  // First few lines often have the title
  const lines = text.split("\n").filter((l) => l.trim());
  const titleLine = lines.find((l) => l.startsWith("# ") || l.startsWith("## "));
  result.position_name = titleLine?.replace(/^#+\s*/, "").trim() ?? null;

  // Salary
  const parsed = parseSalary(text.slice(0, 5000));
  result.pay_min = parsed.min;
  result.pay_max = parsed.max;
  result.pay_type = parsed.type;

  // Job type
  result.position_type = detectJobType(text.slice(0, 3000));

  // Location
  const locationMatch = text.match(/(?:location|where|based)\s*:?\s*([^\n]+)/i);
  result.location = locationMatch?.[1]?.trim().slice(0, 100) ?? null;

  // Description
  result.description = extractBetween(
    text,
    ["description", "about the role", "what you.ll do", "overview", "responsibilities"],
    ["requirements?", "qualifications?", "what you.ll need"],
    5000,
  ) ?? text.slice(0, 3000);

  result.requirements = extractBetween(
    text,
    ["requirements?", "qualifications?", "what you.ll need"],
    ["benefits?", "what we offer", "about us"],
    3000,
  );

  result.benefits = extractBetween(
    text,
    ["benefits?", "what we offer", "perks?"],
    ["about us", "how to apply"],
    2000,
  );

  result.posted_at = parsePostedDate(text.slice(0, 1000));

  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, text } = body;

    if (!url && !text) {
      return new Response(
        JSON.stringify({ error: "url or text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: Partial<ScrapedJob>;

    if (text && typeof text === "string") {
      // ── Text-paste mode: parse directly, no fetch needed ──
      result = parseFromText(text);
    } else {
      // ── URL mode: fetch then parse ──
      // Strategy 1: Direct fetch
      try {
        result = await fetchAndParse(url);
        if (!result.position_name) throw new Error("Insufficient data from direct fetch");
      } catch (directErr) {
        console.log("Direct fetch failed, trying Jina AI:", directErr.message);
        // Strategy 2: Jina AI Reader fallback
        result = await fetchViaJina(url);
      }
    }

    // Normalize the response
    const output: ScrapedJob = {
      company_name: result.company_name ?? null,
      company_url: result.company_url ?? null,
      position_name: result.position_name ?? null,
      position_type: result.position_type ?? null,
      location: result.location ?? null,
      pay_min: result.pay_min ?? null,
      pay_max: result.pay_max ?? null,
      pay_type: result.pay_type ?? null,
      description: result.description ?? null,
      requirements: result.requirements ?? null,
      benefits: result.benefits ?? null,
      travel_requirements: result.travel_requirements ?? null,
      url_listing: url ?? null,
      url_application: result.url_application ?? null,
      posted_at: result.posted_at ?? null,
    };

    return new Response(
      JSON.stringify(output),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("scrape-job error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Failed to scrape job listing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
