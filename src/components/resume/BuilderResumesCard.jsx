import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ResumeDownloadButton from "./ResumeDownloadButton";
import { getResume, listResumes } from "../../services/resumeService";
import { tailoredFileSuffix } from "../../utils/resumeTemplate";

// The resumes made in the Resume Builder, listed on the Documents page. They
// live in the builder (always up to date there); this list links to them and
// downloads fresh PDF / Word files on request.

const builderPath = (r) => (r.is_master ? "/resume" : `/resume/${r.id}`);

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function BuilderResumesCard() {
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listResumes()
      .then((list) => !cancelled && setResumes(list))
      .catch((err) => !cancelled && setError(err.message ?? String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="h6">From the Resume Builder</Typography>
        <Typography variant="body2" color="text.secondary">
          Your master resume and tailored copies. Downloads are always made from the latest version.
        </Typography>
      </CardContent>

      {error && (
        <Typography color="error" sx={{ px: 2, pb: 2 }}>
          Couldn't load your resumes: {error}
        </Typography>
      )}
      {resumes === null && !error && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {resumes?.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>
          You haven't made a resume in the builder yet. Open the Resume Builder to start one.
        </Typography>
      )}
      {resumes?.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Last edited</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resumes.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography fontWeight="medium">{r.is_master ? "Master resume" : r.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip label="Resume" size="small" color="primary" />
                      {r.is_master ? (
                        <Chip label="Master" size="small" color="success" />
                      ) : (
                        <Chip label="Tailored" size="small" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDate(r.updated_at)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button component={RouterLink} to={builderPath(r)} size="small" startIcon={<EditIcon fontSize="small" />}>
                      Open in builder
                    </Button>
                    <ResumeDownloadButton
                      compact
                      getContent={() => getResume(r.id).then((full) => full.content)}
                      fileSuffix={r.is_master ? "" : tailoredFileSuffix(r.name)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}
