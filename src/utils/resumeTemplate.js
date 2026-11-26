// Shape of a resume's `content` (stored as JSON in the resumes table).
//
// Every piece of text is a small HTML string. The only formatting allowed is
// <strong> (bold), so the PDF / Word exports only need to handle bold runs.
//
// {
//   header: { name, title, location, phone, email, linkedin },
//   sections: [
//     { id, type: "summary",    title, hidden, text },
//     { id, type: "skills",     title, hidden, items:   [{ id, text, hidden }] },
//     { id, type: "experience", title, hidden, jobs:    [{ id, title, company, location,
//                                                          dates, description,
//                                                          bullets: [{ id, text, hidden }] }] },
//     { id, type: "education",  title, hidden, entries: [{ id, degree, school, details }] },
//     { id, type: "list",       title, hidden, items:   [{ id, text, hidden }] },
//   ]
// }
//
// The sample below is made up. This repository is public, so never put a real
// person's resume here.

export const newId = () => crypto.randomUUID();

export const newBullet = (text = "") => ({ id: newId(), text, hidden: false });

export const newJob = () => ({
  id: newId(),
  title: "",
  company: "",
  location: "",
  dates: "",
  description: "",
  bullets: [newBullet()],
});

export const newEducation = () => ({ id: newId(), degree: "", school: "", details: "" });

// A tailored resume is named "Job title – Company"; downloads of it add the
// company to the file name: "Marketing Manager – Summit Outdoor" -> "Summit Outdoor".
export function tailoredFileSuffix(name) {
  const parts = (name ?? "").split(" – ");
  return parts[parts.length - 1].trim();
}

// An extra section of plain lines, such as Volunteer Experience or Certifications.
export const newListSection = () => ({
  id: newId(),
  type: "list",
  title: "",
  hidden: false,
  items: [newBullet()],
});

export function sampleResumeContent() {
  return {
    header: {
      name: "Jordan Rivera",
      title: "Marketing Manager",
      location: "Denver, CO",
      phone: "(555) 010-2030",
      email: "jordan.rivera@example.com",
      linkedin: "linkedin.com/in/jordan-rivera-example",
    },
    sections: [
      {
        id: newId(),
        type: "summary",
        title: "Summary",
        hidden: false,
        text:
          "Marketing manager with 7 years of experience growing brands through " +
          "data-driven campaigns, content strategy and cross-team project management.",
      },
      {
        id: newId(),
        type: "skills",
        title: "Skills",
        hidden: false,
        items: [
          newBullet("<strong>Marketing:</strong> Campaign strategy, SEO, email marketing, social media"),
          newBullet("<strong>Tools:</strong> HubSpot, Google Analytics, Canva, Asana"),
          newBullet("<strong>Project management:</strong> Agile planning, budgeting, vendor management"),
        ],
      },
      {
        id: newId(),
        type: "experience",
        title: "Professional Experience",
        hidden: false,
        jobs: [
          {
            id: newId(),
            title: "Marketing Manager",
            company: "Summit Outdoor Co.",
            location: "CO",
            dates: "Feb 2022 – Mar 2026",
            description: "Regional outdoor gear retailer with 12 stores and an online shop.",
            bullets: [
              newBullet("Led a team of <strong>4</strong> to plan and launch seasonal campaigns across email, social and in-store."),
              newBullet("Grew online sales <strong>35%</strong> in two years by rebuilding the email program."),
              newBullet("Managed a <strong>$400K</strong> annual marketing budget and vendor relationships."),
            ],
          },
          {
            id: newId(),
            title: "Marketing Coordinator",
            company: "Bright Path Learning",
            location: "CO",
            dates: "Jun 2019 – Jan 2022",
            description: "",
            bullets: [
              newBullet("Wrote and scheduled content for <strong>3</strong> social channels."),
              newBullet("Coordinated <strong>20+</strong> events a year with partner schools."),
            ],
          },
        ],
      },
      {
        id: newId(),
        type: "education",
        title: "Education",
        hidden: false,
        entries: [
          {
            id: newId(),
            degree: "B.A. Communications",
            school: "Example State University",
            details: "Related Courses: Digital Marketing, Consumer Behavior, Statistics",
          },
        ],
      },
      {
        id: newId(),
        type: "list",
        title: "Professional Affiliations",
        hidden: false,
        items: [
          newBullet("American Marketing Association, Member"),
          newBullet("Denver Small Business Network, Volunteer"),
        ],
      },
    ],
  };
}
