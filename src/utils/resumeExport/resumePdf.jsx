// Builds the PDF download from the resume model (resumeModel.js), with the same
// layout as the Word file: US Letter, single column, real (selectable) text so
// applicant tracking systems (ATS) can read it.
//
// Calibri can't be embedded (it's licensed to Microsoft), so the PDF uses
// Carlito, a free font made to be the same size and shape as Calibri.

/* eslint-disable react-refresh/only-export-components --
   These components only describe the PDF; the app never renders them on screen. */
import { Document, Font, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import carlitoRegular from "@fontsource/carlito/files/carlito-latin-400-normal.woff?url";
import carlitoBold from "@fontsource/carlito/files/carlito-latin-700-normal.woff?url";

Font.register({
  family: "Carlito",
  fonts: [
    { src: carlitoRegular, fontWeight: 400 },
    { src: carlitoBold, fontWeight: 700 },
  ],
});
// Never split words with hyphens at the end of a line.
Font.registerHyphenationCallback((word) => [word]);

const IN = 72; // points per inch

const s = StyleSheet.create({
  page: {
    fontFamily: "Carlito",
    fontSize: 10.5,
    lineHeight: 1.2,
    // Turn off ligatures: Carlito draws "ti" as one joined glyph, and PDF
    // readers (including ATS) then read "Marketing" as "Marketng".
    fontFeatureSettings: { liga: false, clig: false },
    paddingTop: 0.625 * IN,
    paddingBottom: 0.625 * IN,
    paddingHorizontal: 0.75 * IN,
    color: "#000",
  },
  center: { textAlign: "center" },
  // A line height set on the page becomes a fixed size (1.2 × 10.5pt), so
  // bigger text needs its own or the lines overlap.
  name: { fontSize: 18, lineHeight: 1.2, fontWeight: 700, textAlign: "center" },
  title: { fontSize: 12, lineHeight: 1.2, fontWeight: 700, textAlign: "center" },
  heading: {
    fontSize: 11.5,
    lineHeight: 1.2,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 4,
    paddingBottom: 1,
    borderBottomWidth: 0.75,
    borderBottomColor: "#000",
  },
  bold: { fontWeight: 700 },
  bulletRow: { flexDirection: "row", paddingLeft: 0.25 * IN },
  bulletMark: { width: 0.2 * IN },
  bulletText: { flex: 1 },
});

function Runs({ runs, style }) {
  return (
    <Text style={style}>
      {runs.map((r, i) => (
        <Text key={i} style={r.bold ? s.bold : undefined}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

function SectionBody({ section }) {
  switch (section.type) {
    case "paragraph":
      return <Runs runs={section.runs} />;
    case "lines":
      return section.lines.map((runs, i) => <Runs key={i} runs={runs} />);
    case "experience":
      return section.jobs.map((job, i) => (
        <View key={i} style={{ marginTop: i ? 6 : 0 }}>
          {/* Keep a job's heading, dates and description with its first bullet. */}
          <View wrap={false}>
            {job.heading && <Text style={s.bold}>{job.heading}</Text>}
            {job.dates && <Text>{job.dates}</Text>}
            {job.description.length > 0 && <Runs runs={job.description} />}
          </View>
          {job.bullets.map((runs, j) => (
            <View key={j} style={s.bulletRow} wrap={false}>
              <Text style={s.bulletMark}>•</Text>
              <Runs runs={runs} style={s.bulletText} />
            </View>
          ))}
        </View>
      ));
    case "education":
      return section.entries.map((entry, i) => (
        <View key={i} style={{ marginTop: i ? 4 : 0 }} wrap={false}>
          {entry.heading && <Text style={s.bold}>{entry.heading}</Text>}
          {entry.details.length > 0 && <Runs runs={entry.details} />}
        </View>
      ));
    default:
      return null;
  }
}

function ResumeDocument({ model }) {
  const { header } = model;
  return (
    <Document title={header.name ? `${header.name} Resume` : "Resume"} author={header.name || undefined}>
      <Page size="LETTER" style={s.page}>
        {header.name && <Text style={s.name}>{header.name}</Text>}
        {header.title && <Text style={s.title}>{header.title}</Text>}
        {header.contactLine && <Text style={s.center}>{header.contactLine}</Text>}
        {header.linkedin && <Text style={s.center}>{header.linkedin}</Text>}
        {model.sections.map((section, i) => (
          <View key={i}>
            <Text style={s.heading} minPresenceAhead={30}>
              {section.title}
            </Text>
            <SectionBody section={section} />
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function buildResumePdf(model) {
  return pdf(<ResumeDocument model={model} />).toBlob();
}
