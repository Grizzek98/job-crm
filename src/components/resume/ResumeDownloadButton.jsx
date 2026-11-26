import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

// "Download" with a choice of PDF or Word. Both are built in the browser from
// the same content, so they match. The libraries load only when first used.
//
// getContent: returns the resume content (or a promise of it), so a list can
//   load a resume only when it's downloaded.
// compact: an icon button (for table rows) instead of the big button.
export default function ResumeDownloadButton({ getContent, fileSuffix = "", compact = false }) {
  const [anchor, setAnchor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const download = async (format) => {
    setAnchor(null);
    setBusy(true);
    setError(null);
    try {
      const [content, { buildResumeModel, resumeFileName, downloadBlob }] = await Promise.all([
        getContent(),
        import("../../utils/resumeExport/resumeModel"),
      ]);
      const model = buildResumeModel(content);
      if (format === "pdf") {
        const { buildResumePdf } = await import("../../utils/resumeExport/resumePdf");
        downloadBlob(await buildResumePdf(model), resumeFileName(model, "pdf", fileSuffix));
      } else {
        const { buildResumeDocx } = await import("../../utils/resumeExport/resumeDocx");
        downloadBlob(await buildResumeDocx(model), resumeFileName(model, "docx", fileSuffix));
      }
    } catch (err) {
      console.error(err);
      setError("Sorry, the download didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const open = (e) => setAnchor(e.currentTarget);

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
      {compact ? (
        <Tooltip title="Download as PDF or Word">
          <span>
            <IconButton size="small" onClick={open} disabled={busy} aria-label="Download">
              {busy ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          endIcon={<ArrowDropDownIcon />}
          disabled={busy}
          onClick={open}
        >
          {busy ? "Preparing…" : "Download"}
        </Button>
      )}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => download("pdf")}>
          <ListItemIcon>
            <PictureAsPdfOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="PDF" secondary="Best for most job applications" />
        </MenuItem>
        <MenuItem onClick={() => download("docx")}>
          <ListItemIcon>
            <DescriptionOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Word (.docx)" secondary="When a job asks for Word, or to edit it later" />
        </MenuItem>
      </Menu>
    </Box>
  );
}
