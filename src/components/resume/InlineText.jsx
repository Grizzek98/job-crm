import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Box } from "@mui/material";

// One line of click-to-edit text for the resume. Enter does nothing (each line
// is its own field), and the only formatting is bold (Ctrl+B), when allowed.

const SingleLine = Extension.create({
  name: "singleLine",
  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      "Shift-Enter": () => true,
    };
  },
});

const toEditorHtml = (value) => `<p>${value ?? ""}</p>`;

// "<p>a <strong>b</strong></p>" -> "a <strong>b</strong>". Pasted paragraphs are
// joined with a space so the value stays one line.
function fromEditorHtml(html) {
  return html
    .replace(/<\/p>\s*<p>/g, " ")
    .replace(/^<p>/, "")
    .replace(/<\/p>$/, "")
    .replace(/<br\s*\/?>/g, " ");
}

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// formatOnBlur (optional): a function that tidies the plain text when the
// person clicks away, e.g. turning "2/2022 - now" into "Feb 2022 – Present".
// Only use it on fields without bold, since it works on plain text.
export default function InlineText({ value, onChange, placeholder, allowBold = true, formatOnBlur, sx }) {
  const onChangeRef = useRef(onChange);
  const formatRef = useRef(formatOnBlur);
  useEffect(() => {
    onChangeRef.current = onChange;
    formatRef.current = formatOnBlur;
  }, [onChange, formatOnBlur]);

  const [isEmpty, setIsEmpty] = useState(!value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: allowBold ? {} : false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        heading: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        hardBreak: false,
        link: false,
        trailingNode: false,
      }),
      SingleLine,
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      onChangeRef.current(editor.isEmpty ? "" : fromEditorHtml(editor.getHTML()));
    },
    onBlur: ({ editor }) => {
      if (!formatRef.current) return;
      const text = editor.getText();
      const tidy = formatRef.current(text);
      if (tidy === text) return;
      const html = escapeHtml(tidy);
      editor.commands.setContent(toEditorHtml(html), { emitUpdate: false });
      setIsEmpty(!tidy);
      onChangeRef.current(html);
    },
  });

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: "2px",
        cursor: "text",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-within": { outline: "1px solid", outlineColor: "primary.light" },
        "& .ProseMirror": { outline: "none", minHeight: "1em" },
        "& .ProseMirror p": { m: 0 },
        "& strong": { fontWeight: 700 },
        ...sx,
      }}
    >
      {isEmpty && placeholder && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            inset: 0,
            color: "text.disabled",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {placeholder}
        </Box>
      )}
      <EditorContent editor={editor} />
    </Box>
  );
}
