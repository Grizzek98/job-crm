// Builds the Word (.docx) download from the resume model (resumeModel.js).
// One plain, single-column layout with no tables, text boxes or columns, so
// applicant tracking systems (ATS) can read it. Calibri throughout.
//
// Units: docx sizes are in half-points (21 = 10.5pt), and spacing, indents and
// margins are in twentieths of a point ("twips", 1440 per inch).

import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const inch = (n) => Math.round(n * 1440);
const pt = (n) => Math.round(n * 20);

const SIZE = { name: 36, title: 24, body: 21, heading: 23 };

const runsToTextRuns = (runs, extra = {}) =>
  runs.map((r) => new TextRun({ text: r.text, bold: r.bold || undefined, ...extra }));

const para = (children, options = {}) => new Paragraph({ children, ...options });

function sectionHeading(title) {
  return para([new TextRun({ text: title, bold: true, size: SIZE.heading })], {
    spacing: { before: pt(10), after: pt(4) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
    keepNext: true,
  });
}

function sectionBody(section) {
  switch (section.type) {
    case "paragraph":
      return [para(runsToTextRuns(section.runs))];
    case "lines":
      return section.lines.map((runs) => para(runsToTextRuns(runs)));
    case "experience":
      return section.jobs.flatMap((job, i) => [
        ...(job.heading
          ? [para([new TextRun({ text: job.heading, bold: true })], { keepNext: true, spacing: { before: i ? pt(6) : 0 } })]
          : []),
        ...(job.dates ? [para([new TextRun(job.dates)], { keepNext: true })] : []),
        ...(job.description.length ? [para(runsToTextRuns(job.description), { keepNext: true })] : []),
        ...job.bullets.map((runs) => para(runsToTextRuns(runs), { numbering: { reference: "bullets", level: 0 } })),
      ]);
    case "education":
      return section.entries.flatMap((entry, i) => [
        ...(entry.heading
          ? [para([new TextRun({ text: entry.heading, bold: true })], { keepNext: true, spacing: { before: i ? pt(4) : 0 } })]
          : []),
        ...(entry.details.length ? [para(runsToTextRuns(entry.details))] : []),
      ]);
    default:
      return [];
  }
}

export async function buildResumeDocx(model) {
  const { header } = model;
  const center = { alignment: AlignmentType.CENTER };

  const children = [
    ...(header.name ? [para([new TextRun({ text: header.name, bold: true, size: SIZE.name })], center)] : []),
    ...(header.title ? [para([new TextRun({ text: header.title, bold: true, size: SIZE.title })], center)] : []),
    ...(header.contactLine ? [para([new TextRun(header.contactLine)], center)] : []),
    ...(header.linkedin ? [para([new TextRun(header.linkedin)], center)] : []),
    ...model.sections.flatMap((s) => [sectionHeading(s.title), ...sectionBody(s)]),
  ];

  const doc = new Document({
    title: header.name ? `${header.name} Resume` : "Resume",
    creator: header.name || undefined,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: SIZE.body },
          paragraph: { spacing: { before: 0, after: 0, line: 240 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: inch(0.45), hanging: inch(0.2) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: inch(8.5), height: inch(11) },
            margin: { top: inch(0.625), bottom: inch(0.625), left: inch(0.75), right: inch(0.75) },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
