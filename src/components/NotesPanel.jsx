import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon              from "@mui/icons-material/Add";
import CloseIcon            from "@mui/icons-material/Close";
import DeleteIcon           from "@mui/icons-material/Delete";
import FormatBoldIcon       from "@mui/icons-material/FormatBold";
import FormatItalicIcon     from "@mui/icons-material/FormatItalic";
import FormatIndentDecreaseIcon from "@mui/icons-material/FormatIndentDecrease";
import FormatIndentIncreaseIcon from "@mui/icons-material/FormatIndentIncrease";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import LooksOneIcon         from "@mui/icons-material/LooksOne";
import LooksTwoIcon         from "@mui/icons-material/LooksTwo";
import RedoIcon             from "@mui/icons-material/Redo";
import StickyNote2Icon      from "@mui/icons-material/StickyNote2";
import UndoIcon             from "@mui/icons-material/Undo";
import { getNotes, createNote, updateNote, deleteNote } from "../services/noteService";

// ── Custom indent extension ───────────────────────────────────────────────────
const INDENT_PX  = 24; // pixels per level
const MAX_INDENT = 8;
const INDENTABLE = new Set(["paragraph", "heading"]);

function isInList(state) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "bulletList" || name === "orderedList" || name === "listItem") return true;
  }
  return false;
}

const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        indent: {
          default: 0,
          parseHTML:  (el)    => Math.round(parseInt(el.style.marginLeft  ?? "0", 10) / INDENT_PX),
          renderHTML: (attrs) => attrs.indent ? { style: `margin-left: ${attrs.indent * INDENT_PX}px` } : {},
        },
      },
    }];
  },

  addCommands() {
    const applyIndent = (delta) => () => ({ tr, state, dispatch }) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!INDENTABLE.has(node.type.name)) return;
        const current = node.attrs.indent ?? 0;
        const next    = Math.max(0, Math.min(MAX_INDENT, current + delta));
        if (next !== current) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        }
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
    return { indent: applyIndent(+1), outdent: applyIndent(-1) };
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (isInList(editor.state)) return false; // let StarterKit handle list-Tab
        const { $from } = editor.state.selection;
        return INDENTABLE.has($from.node().type.name) && editor.commands.indent();
      },
      "Shift-Tab": ({ editor }) => {
        if (isInList(editor.state)) return false;
        const { $from } = editor.state.selection;
        return INDENTABLE.has($from.node().type.name) && editor.commands.outdent();
      },
    };
  },
});

// ── Small toolbar button ──────────────────────────────────────────────────────
function ToolbarBtn({ title, onClick, active, children }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          onMouseDown={(e) => {
            // Prevent editor from losing focus on toolbar click
            e.preventDefault();
            onClick();
          }}
          sx={{
            borderRadius: 1,
            p: 0.5,
            bgcolor: active ? "action.selected" : "transparent",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────
export default function NotesPanel({ onClose }) {
  const [notes,      setNotes]      = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "unsaved"
  const [loading,    setLoading]    = useState(true);
  const [hoveredId,  setHoveredId]  = useState(null);

  // Inline rename state
  const [renamingId,  setRenamingId]  = useState(null);
  const [renameVal,   setRenameVal]   = useState("");

  const saveTimerRef   = useRef(null);
  const currentSaveRef = useRef({ id: null, dirty: false });
  const editorRef      = useRef(null);

  // ── TipTap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [StarterKit, Indent],
    content: "",
    onUpdate: ({ editor }) => {
      currentSaveRef.current.dirty = true;
      setSaveStatus("unsaved");
      clearTimeout(saveTimerRef.current);
      // Capture id at scheduling time — avoids stale closure if user switches notes
      const idToSave = currentSaveRef.current.id;
      saveTimerRef.current = setTimeout(async () => {
        if (!idToSave) return;
        setSaveStatus("saving");
        try {
          const content = editor.getJSON();
          await updateNote(idToSave, { content });
          setNotes((prev) => prev.map((n) => (n.id === idToSave ? { ...n, content } : n)));
          if (currentSaveRef.current.id === idToSave) {
            currentSaveRef.current.dirty = false;
            setSaveStatus("saved");
          }
        } catch {
          setSaveStatus("unsaved");
        }
      }, 1500);
    },
  });

  // Keep editorRef in sync so the unmount cleanup can access the live instance
  useEffect(() => { editorRef.current = editor; }, [editor]);

  // Save on unmount (catches the "close panel while typing" case)
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      const { id, dirty } = currentSaveRef.current;
      if (dirty && id && editorRef.current) {
        updateNote(id, { content: editorRef.current.getJSON() }).catch(console.error);
      }
    };
  }, []);

  // Load notes on first mount
  useEffect(() => { loadNotes(); }, []); // eslint-disable-line

  async function loadNotes() {
    setLoading(true);
    try {
      const data = await getNotes();
      setNotes(data);
      if (data.length > 0) {
        currentSaveRef.current = { id: data[0].id, dirty: false };
        setSelectedId(data[0].id);
        // Editor may not be ready yet — handled by the effect below
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Once editor is ready, load the selected note's content into it
  useEffect(() => {
    if (!editor || !selectedId) return;
    const note = notes.find((n) => n.id === selectedId);
    if (!note) return;
    editor.commands.setContent(
      note.content ?? { type: "doc", content: [{ type: "paragraph" }] },
      false, // don't emit update — avoids triggering auto-save on load
    );
  }, [editor]); // eslint-disable-line — intentionally fires only when editor mounts

  // ── Note switching ────────────────────────────────────────────────────────
  async function switchToNote(note) {
    if (note.id === selectedId) return;

    // Flush any pending save for the note we're leaving
    clearTimeout(saveTimerRef.current);
    if (currentSaveRef.current.dirty && currentSaveRef.current.id && editor) {
      try {
        const content = editor.getJSON();
        const id = currentSaveRef.current.id;
        await updateNote(id, { content });
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
      } catch { /* best effort */ }
    }

    currentSaveRef.current = { id: note.id, dirty: false };
    setSelectedId(note.id);
    setSaveStatus("saved");
    editor?.commands.setContent(
      note.content ?? { type: "doc", content: [{ type: "paragraph" }] },
      false,
    );
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleAddNote() {
    try {
      const note = await createNote({ title: "Untitled" });
      setNotes((prev) => [note, ...prev]);
      currentSaveRef.current = { id: note.id, dirty: false };
      setSelectedId(note.id);
      setSaveStatus("saved");
      editor?.commands.setContent(
        { type: "doc", content: [{ type: "paragraph" }] },
        false,
      );
      // Start renaming immediately so the user can give it a real name
      setRenamingId(note.id);
      setRenameVal("Untitled");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteNote(e, id) {
    e.stopPropagation();
    try {
      await deleteNote(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (selectedId === id) {
        if (remaining.length > 0) {
          const next = remaining[0];
          currentSaveRef.current = { id: next.id, dirty: false };
          setSelectedId(next.id);
          editor?.commands.setContent(
            next.content ?? { type: "doc", content: [{ type: "paragraph" }] },
            false,
          );
        } else {
          currentSaveRef.current = { id: null, dirty: false };
          setSelectedId(null);
          editor?.commands.setContent("", false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  function startRename(e, note) {
    e.stopPropagation();
    setRenamingId(note.id);
    setRenameVal(note.title);
  }

  async function commitRename(id) {
    const trimmed = renameVal.trim() || "Untitled";
    setRenamingId(null);
    setRenameVal("");
    try {
      await updateNote(id, { title: trimmed });
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: trimmed } : n)));
    } catch { /* best effort */ }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameVal("");
  }

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper", overflow: "hidden" }}>

      {/* ── Panel header ── */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        px: 1.5, py: 0.75, flexShrink: 0,
        borderBottom: "1px solid", borderColor: "divider",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <StickyNote2Icon sx={{ fontSize: 16, color: "text.secondary" }} />
          <Typography variant="subtitle2" fontWeight="bold">Notes</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title="New note">
            <IconButton size="small" onClick={handleAddNote}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close notes">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Body ── */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : notes.length === 0 ? (
        /* Empty state */
        <Box sx={{ textAlign: "center", p: 4 }}>
          <StickyNote2Icon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            No notes yet — jot something down!
          </Typography>
          <IconButton color="primary" onClick={handleAddNote}>
            <AddIcon />
          </IconButton>
        </Box>
      ) : (
        <>
          {/* ── Note list ── */}
          <Box sx={{
            flexShrink: 0,
            maxHeight: 180,
            overflowY: "auto",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}>
            <List dense disablePadding>
              {notes.map((note) => (
                <ListItem
                  key={note.id}
                  disablePadding
                  secondaryAction={
                    hoveredId === note.id && renamingId !== note.id ? (
                      <Tooltip title="Delete note">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e) => handleDeleteNote(e, note.id)}
                          sx={{ color: "error.main", mr: 0.5 }}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    ) : undefined
                  }
                  onMouseEnter={() => setHoveredId(note.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {renamingId === note.id ? (
                    /* Inline rename field */
                    <Box sx={{ px: 1.5, py: 0.25, width: "100%" }}>
                      <TextField
                        autoFocus
                        size="small"
                        variant="standard"
                        fullWidth
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={() => commitRename(note.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  commitRename(note.id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        slotProps={{ input: { sx: { fontSize: 13 } } }}
                      />
                    </Box>
                  ) : (
                    <ListItemButton
                      selected={note.id === selectedId}
                      onClick={() => switchToNote(note)}
                      onDoubleClick={(e) => startRename(e, note)}
                      sx={{ py: 0.5, pl: 1.5, pr: hoveredId === note.id ? 4 : 1.5 }}
                    >
                      <ListItemText
                        primary={note.title}
                        slotProps={{
                          primary: {
                            fontSize: 13,
                            noWrap: true,
                            fontWeight: note.id === selectedId ? 600 : 400,
                          },
                        }}
                      />
                    </ListItemButton>
                  )}
                </ListItem>
              ))}
            </List>
          </Box>

          {/* ── Active note area ── */}
          {selectedNote && (
            <>
              {/* Formatting toolbar */}
              <Box sx={{
                display: "flex", alignItems: "center", gap: 0.25,
                px: 0.75, py: 0.5, flexShrink: 0,
                borderBottom: "1px solid", borderColor: "divider",
                flexWrap: "wrap",
              }}>
                <ToolbarBtn
                  title="Bold (Ctrl+B)"
                  active={editor?.isActive("bold")}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <FormatBoldIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Italic (Ctrl+I)"
                  active={editor?.isActive("italic")}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                  <FormatItalicIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Underline (Ctrl+U)"
                  active={editor?.isActive("underline")}
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                >
                  <FormatUnderlinedIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                <ToolbarBtn
                  title="Heading 1"
                  active={editor?.isActive("heading", { level: 1 })}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                  <LooksOneIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Heading 2"
                  active={editor?.isActive("heading", { level: 2 })}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <LooksTwoIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                <ToolbarBtn
                  title="Bullet list"
                  active={editor?.isActive("bulletList")}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                  <FormatListBulletedIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Numbered list"
                  active={editor?.isActive("orderedList")}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                  <FormatListNumberedIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                <ToolbarBtn
                  title="Indent (Tab)"
                  onClick={() => editor?.chain().focus().indent().run()}
                >
                  <FormatIndentIncreaseIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Outdent (Shift+Tab)"
                  onClick={() => editor?.chain().focus().outdent().run()}
                >
                  <FormatIndentDecreaseIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                <ToolbarBtn
                  title="Undo (Ctrl+Z)"
                  onClick={() => editor?.chain().focus().undo().run()}
                >
                  <UndoIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Redo (Ctrl+Y)"
                  onClick={() => editor?.chain().focus().redo().run()}
                >
                  <RedoIcon sx={{ fontSize: 18 }} />
                </ToolbarBtn>
              </Box>

              {/* Editor area */}
              <Box
                sx={{
                  flex: 1,
                  overflow: "auto",
                  "& .ProseMirror": {
                    outline: "none",
                    minHeight: "100%",
                    padding: "12px 16px",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    "& h1": { fontSize: "1.4rem", fontWeight: 700, margin: "12px 0 6px 0" },
                    "& h2": { fontSize: "1.15rem", fontWeight: 600, margin: "10px 0 4px 0" },
                    "& ul": { paddingLeft: "20px", listStyleType: "disc" },
                    "& ol": { paddingLeft: "20px", listStyleType: "decimal" },
                    "& li + li": { marginTop: "2px" },
                    "& p": { margin: "0 0 4px 0", whiteSpace: "pre-wrap" },
                    "& strong": { fontWeight: 700 },
                    "& em": { fontStyle: "italic" },
                    "& u": { textDecoration: "underline" },
                  },
                }}
              >
                <EditorContent editor={editor} style={{ height: "100%" }} />
              </Box>

              {/* Save indicator */}
              <Box sx={{
                px: 1.5, py: 0.5, flexShrink: 0,
                borderTop: "1px solid", borderColor: "divider",
                display: "flex", justifyContent: "flex-end",
              }}>
                <Typography
                  variant="caption"
                  color={saveStatus === "unsaved" ? "warning.main" : "text.disabled"}
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : "Saved ✓"}
                </Typography>
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
}
