import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Link, Paper, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WorkOutlineIcon from "@mui/icons-material/WorkOutlined";
import { getPositionForResume } from "../../services/resumeService";

// The job listing shown beside a tailored resume, so its priorities are in
// view while reordering bullets. It can be closed to a slim tab for more room;
// the choice is remembered in this browser.

const OPEN_KEY = "resume.jobPanelOpen";

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

const STICKY = { position: "sticky", top: 16, alignSelf: "flex-start", flex: "none" };

export default function JobListingPanel({ positionId }) {
  const [open, setOpen] = useState(readOpen);
  const [position, setPosition] = useState(undefined); // undefined = loading, null = gone
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getPositionForResume(positionId)
      .then((p) => !cancelled && setPosition(p))
      .catch((err) => !cancelled && setError(err.message ?? String(err)));
    return () => {
      cancelled = true;
    };
  }, [positionId]);

  const toggle = (value) => {
    setOpen(value);
    try {
      localStorage.setItem(OPEN_KEY, String(value));
    } catch {
      // Not remembered (private window); that's fine.
    }
  };

  if (!open) {
    return (
      <Box sx={{ ...STICKY, mt: 1 }}>
        <Tooltip title="Show the job listing" placement="left">
          <Button
            variant="outlined"
            onClick={() => toggle(true)}
            sx={{ minWidth: 0, px: 0.5, py: 1.5, flexDirection: "column", gap: 1, bgcolor: "background.paper" }}
          >
            <ChevronLeftIcon />
            <Box component="span" sx={{ writingMode: "vertical-rl", textTransform: "none", whiteSpace: "nowrap" }}>
              Job listing
            </Box>
          </Button>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ ...STICKY, mt: 1, width: 340, maxHeight: "calc(100vh - 32px)", overflowY: "auto", p: 2 }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
        <WorkOutlineIcon color="action" sx={{ mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            Tailoring for
          </Typography>
          {position && (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {position.name}
              </Typography>
              {position.companies?.name && (
                <Typography variant="body2" color="text.secondary">
                  {position.companies.name}
                </Typography>
              )}
            </>
          )}
        </Box>
        <Tooltip title="Hide the job listing">
          <IconButton size="small" onClick={() => toggle(false)} aria-label="Hide the job listing">
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Typography color="error">Couldn't load the job: {error}</Typography>}
      {position === undefined && !error && <CircularProgress size={20} />}
      {position === null && (
        <Typography variant="body2" color="text.secondary">
          This job has been deleted. Your tailored resume is still here.
        </Typography>
      )}

      {position && (
        <>
          {position.url_listing && (
            <Link href={position.url_listing} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 1 }}>
              Open the original listing <OpenInNewIcon sx={{ fontSize: 14 }} />
            </Link>
          )}
          <ListingText title="Requirements" text={position.requirements} />
          <ListingText title="Description" text={position.description} />
          {!position.requirements && !position.description && (
            <Typography variant="body2" color="text.secondary">
              This job doesn't have a description or requirements saved yet. You can paste them in
              by editing the job on the Positions page.
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
}

function ListingText({ title, text }) {
  if (!text?.trim()) return null;
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {text.trim()}
      </Typography>
    </Box>
  );
}
