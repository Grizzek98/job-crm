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
import { getCompanies, deleteCompany } from "../services/companyService";
import { useNotify } from "../context/NotificationContext";
import { normalizeUrl } from "../utils/url";
import CompanyFormDialog from "../components/CompanyFormDialog";

export default function Companies() {
  const notify = useNotify();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null); // null = adding new

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Data loading ---

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      notify(err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- Dialog handlers ---

  function openAddDialog() {
    setEditingCompany(null);
    setDialogOpen(true);
  }

  function openEditDialog(company) {
    setEditingCompany(company);
    setDialogOpen(true);
  }

  function handleSaved(saved, isNew) {
    setCompanies((prev) =>
      isNew
        ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        : prev.map((c) => (c.id === saved.id ? saved : c)),
    );
  }

  // --- Delete handlers ---

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteCompany(deleteTarget.id);
      setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
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
          Companies
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Company
        </Button>
      </Stack>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : companies.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No companies yet. Add one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Glassdoor</TableCell>
                    <TableCell>Website</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {company.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {company.size ? company.size.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {company.glassdoor_rating ? (
                          <Chip
                            label={company.glassdoor_rating}
                            size="small"
                            color={
                              company.glassdoor_rating >= 4
                                ? "success"
                                : company.glassdoor_rating >= 3
                                  ? "warning"
                                  : "error"
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {company.url ? (
                          <Tooltip title={company.url}>
                            <IconButton
                              size="small"
                              href={normalizeUrl(company.url)}
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
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {company.notes ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(company)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(company)}
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
        <CompanyFormDialog
          company={editingCompany}
          onClose={() => setDialogOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>? This will also delete all
            associated positions, applications, and events.
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
