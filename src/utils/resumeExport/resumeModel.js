// Turns a saved resume (see resumeTemplate.js) into a simple, print-ready
// model that both the PDF and the Word downloads are built from, so the two
// always match.
//
// - Hidden sections, bullets and lines are left out.
// - Empty lines, bullets, jobs and schools (unfilled placeholders) are left out.
// - Each piece of text becomes "runs": [{ text, bold }], because bold is the
//   only formatting a resume field can have.
//
// Model:
// {
//   header: { name, title, contactLine, linkedin },          // plain strings
//   sections: [
//     { type: "paragraph", title, runs },                       // summary
//     { type: "lines", title, lines: [runs] },                  // skills, lists
//     { type: "experience", title, jobs: [{ heading, dates, description: runs, bullets: [runs] }] },
//     { type: "education", title, entries: [{ heading, details: runs }] },
//   ]
// }

// "Grew <strong>35%</strong> &amp; more" -> [{text:"Grew ",bold:false}, {text:"35%",bold:true}, ...]
export function htmlToRuns(html) {
  const runs = [];
  const doc = new DOMParser().parseFromString(`<body>${html ?? ""}</body>`, "text/html");
  const walk = (node, bold) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, " ");
        if (!text) continue;
        const last = runs[runs.length - 1];
        if (last && last.bold === bold) last.text += text;
        else runs.push({ text, bold });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child, bold || child.tagName === "STRONG" || child.tagName === "B");
      }
    }
  };
  walk(doc.body, false);
  // Trim the outside edges of the whole line.
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, "");
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
  }
  return runs.filter((r) => r.text);
}

export const htmlToText = (html) => htmlToRuns(html).map((r) => r.text).join("");

const hasText = (runs) => runs.some((r) => r.text.trim());
const joinPipes = (...parts) => parts.map(htmlToText).filter(Boolean).join(" | ");

function visibleLines(items) {
  return (items ?? [])
    .filter((i) => !i.hidden)
    .map((i) => htmlToRuns(i.text))
    .filter(hasText);
}

export function buildResumeModel(content) {
  const h = content.header ?? {};
  const header = {
    name: htmlToText(h.name),
    title: htmlToText(h.title),
    contactLine: joinPipes(h.location, h.phone, h.email),
    linkedin: htmlToText(h.linkedin),
  };

  const sections = [];
  for (const s of content.sections ?? []) {
    if (s.hidden) continue;
    const title = htmlToText(s.title).toUpperCase();

    if (s.type === "summary") {
      const runs = htmlToRuns(s.text);
      if (hasText(runs)) sections.push({ type: "paragraph", title, runs });
    } else if (s.type === "skills" || s.type === "list") {
      const lines = visibleLines(s.items);
      if (lines.length) sections.push({ type: "lines", title, lines });
    } else if (s.type === "experience") {
      const jobs = (s.jobs ?? [])
        .map((j) => ({
          heading: joinPipes(j.title, j.company, j.location),
          dates: htmlToText(j.dates),
          description: htmlToRuns(j.description),
          bullets: visibleLines(j.bullets),
        }))
        .filter((j) => j.heading || j.dates || hasText(j.description) || j.bullets.length);
      if (jobs.length) sections.push({ type: "experience", title, jobs });
    } else if (s.type === "education") {
      const entries = (s.entries ?? [])
        .map((e) => ({ heading: joinPipes(e.degree, e.school), details: htmlToRuns(e.details) }))
        .filter((e) => e.heading || hasText(e.details));
      if (entries.length) sections.push({ type: "education", title, entries });
    }
  }

  return { header, sections };
}

// "Jordan Rivera Resume.pdf" — safe for Windows and Mac file names.
export function resumeFileName(model, extension) {
  const name = model.header.name.replace(/[\\/:*?"<>|]+/g, "").trim();
  return `${name ? `${name} ` : ""}Resume.${extension}`;
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
