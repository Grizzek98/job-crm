import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { getPositions, deletePosition } from "../services/positionService";
import { getCompanies } from "../services/companyService";
import { useNotify } from "../context/NotificationContext";
import PositionFormDialog from "../components/PositionFormDialog";

// Full label map including auto-set statuses (used for display only)
const STATUS_LABELS = {
  active: "Active",
  applying: "Applying",
  applied: "Applied",
  not_interested: "Not Interested",
  closed: "Closed",
};

const TYPE_OPTIONS = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

function statusColor(status) {
  switch (status) {
    case "active":
      return "primary";
    case "applying":
    case "applied":
      return "info";
    case "closed":
      return "error";
    default:
      return "default";
  }
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

function typeLabel(type) {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function formatPay(position) {
  if (!position.pay_min && !position.pay_max) return "—";
  const fmt = (n) => (n != null ? `$${Number(n).toLocaleString()}` : null);
  const min = fmt(position.pay_min);
  const max = fmt(position.pay_max);
  const range = [min, max].filter(Boolean).join(" – ");
  const suffix =
    position.pay_type === "hourly"
      ? "/hr"
      : position.pay_type === "salary"
        ? "/yr"
        : "";
  return range + suffix;
}

export default function Positions() {
  const notify = useNotify();
  const [positions, setPositions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Data loading ---

  useEffect(() => {
    loadPositions();
    loadCompanies();
  }, []);

  async function loadPositions() {
    try {
      setLoading(true);
      const data = await getPositions();
      setPositions(data);
    } catch (err) {
      notify(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      notify(err.message);
    }
  }

  // --- Dialog handlers ---

  function openAddDialog() {
    setEditingPosition(null);
    setDialogOpen(true);
  }

  function openEditDialog(position) {
    setEditingPosition(position);
    setDialogOpen(true);
  }

  function handleSaved(saved, isNew) {
    setPositions((prev) =>
      isNew
        ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        : prev.map((p) => (p.id === saved.id ? saved : p)),
    );
  }

  // --- Delete handlers ---

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deletePosition(deleteTarget.id);
      setPositions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch (err) {
      notify(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  // --- Render ---

  return (
    <Box>
      {/* Page header */}
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Positions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Position
        </Button>
      </Stack>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : positions.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No positions yet. Add one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Job Title</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Pay</TableCell>
                    <TableCell>Listing</TableCell>
                    <TableCell>Application</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {position.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{position.companies?.name ?? "—"}</TableCell>
                      <TableCell>
                        {position.status ? (
                          <Chip
                            label={statusLabel(position.status)}
                            size="small"
                            color={statusColor(position.status)}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {position.type ? typeLabel(position.type) : "—"}
                      </TableCell>
                      <TableCell>{position.location ?? "—"}</TableCell>
                      <TableCell>{formatPay(position)}</TableCell>
                      <TableCell>
                        {position.url_listing ? (
                          <Tooltip title={position.url_listing}>
                            <IconButton
                              size="small"
                              href={position.url_listing}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {position.url_application ? (
                          <Tooltip title={position.url_application}>
                            <IconButton
                              size="small"
                              href={position.url_application}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(position)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(position)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog (shared with CRM) */}
      {dialogOpen && (
        <PositionFormDialog
          position={editingPosition}
          companies={companies}
          onClose={() => setDialogOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Position</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
