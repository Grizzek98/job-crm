import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { getContacts, deleteContact } from "../services/contactService";
import { getCompanies } from "../services/companyService";
import { useNotify } from "../context/NotificationContext";
import ContactFormDialog from "../components/ContactFormDialog";

export default function Contacts() {
  const notify = useNotify();
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadContacts();
    loadCompanies();
  }, []);

  async function loadContacts() {
    try {
      setLoading(true);
      const data = await getContacts();
      setContacts(data);
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

  function openAddDialog() {
    setEditingContact(null);
    setDialogOpen(true);
  }

  function openEditDialog(contact) {
    setEditingContact(contact);
    setDialogOpen(true);
  }

  function handleSaved(saved, isNew) {
    setContacts((prev) =>
      isNew
        ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
        : prev.map((c) => (c.id === saved.id ? saved : c)),
    );
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteContact(deleteTarget.id);
      setContacts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    } catch (err) {
      notify(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
      >
        <Typography variant="h5" fontWeight="bold">
          Contacts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAddDialog}
        >
          Add Contact
        </Button>
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
              <CircularProgress />
            </Box>
          ) : contacts.length === 0 ? (
            <Box sx={{ textAlign: "center", p: 6 }}>
              <Typography color="text.secondary">
                No contacts yet. Add one to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>LinkedIn</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id} hover>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {contact.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{contact.companies?.name ?? "—"}</TableCell>
                      <TableCell>{contact.title ?? "—"}</TableCell>
                      <TableCell>
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`}>
                            {contact.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{contact.phone ?? "—"}</TableCell>
                      <TableCell>
                        {contact.linkedin_url ? (
                          <Tooltip title={contact.linkedin_url}>
                            <IconButton
                              size="small"
                              href={contact.linkedin_url}
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
                            onClick={() => openEditDialog(contact)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(contact)}
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
        <ContactFormDialog
          contact={editingContact}
          companies={companies}
          onClose={() => setDialogOpen(false)}
          onSaved={handleSaved}
        />
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Contact</DialogTitle>
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
