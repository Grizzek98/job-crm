import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { listResumes } from "../../services/resumeService";
import { getPositions } from "../../services/positionService";

// Switch between the master resume and tailored copies, and start a new
// tailored copy for a job.

const resumePath = (r) => (r.is_master ? "/resume" : `/resume/${r.id}`);

export function ResumePicker({ currentId }) {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listResumes()
      .then((list) => !cancelled && setResumes(list))
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  if (!resumes.some((r) => r.id === currentId)) return null;

  return (
    <TextField
      select
      size="small"
      label="Showing"
      value={currentId}
      onChange={(e) => navigate(resumePath(resumes.find((r) => r.id === e.target.value)))}
      sx={{ minWidth: 260, maxWidth: 420 }}
    >
      {resumes.map((r) => (
        <MenuItem key={r.id} value={r.id}>
          {r.is_master ? "Master resume" : r.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function TailorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => setOpen(true)}>
        Tailor for a job
      </Button>
      {open && <TailorDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function TailorDialog({ onClose }) {
  const navigate = useNavigate();
  const [positions, setPositions] = useState(null);
  const [tailoredFor, setTailoredFor] = useState(new Set());
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPositions(), listResumes()])
      .then(([p, r]) => {
        if (cancelled) return;
        setPositions(p);
        setTailoredFor(new Set(r.map((x) => x.position_id).filter(Boolean)));
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = (p) => [p.name, p.companies?.name].filter(Boolean).join(" – ");
  const options = useMemo(() => positions ?? [], [positions]);
  const already = choice && tailoredFor.has(choice.id);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Tailor your resume for a job</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Pick one of your saved jobs. You'll get a copy of your master resume just for that job,
          with the job listing beside it. Changes to the copy never change your master resume.
        </DialogContentText>
        <Autocomplete
          options={options}
          loading={positions === null}
          value={choice}
          onChange={(_, value) => setChoice(value)}
          getOptionLabel={label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderOption={(props, p) => {
            const { key, ...rest } = props;
            return (
              <Box component="li" key={key} {...rest} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                <span>{label(p)}</span>
                {tailoredFor.has(p.id) && (
                  <Box component="span" sx={{ color: "text.secondary", fontSize: 13, whiteSpace: "nowrap" }}>
                    already tailored
                  </Box>
                )}
              </Box>
            );
          }}
          noOptionsText="No saved jobs yet. Add one on the Positions page first."
          renderInput={(params) => <TextField {...params} label="Job" autoFocus />}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!choice}
          onClick={() => {
            onClose();
            navigate(`/resume/job/${choice.id}`);
          }}
        >
          {already ? "Open its resume" : "Make tailored copy"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
