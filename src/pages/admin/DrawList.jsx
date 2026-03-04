import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';

const DrawList = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hour, setHour] = useState(11);
  const formatHourLabel = (h) => {
    const n = Number(h);
    if (n === 12) return '12PM';
    if (n === 0) return '12AM';
    const period = n >= 12 ? 'PM' : 'AM';
    const hour12 = ((n + 11) % 12) + 1;
    return `${hour12}${period}`;
  };
  const [label, setLabel] = useState(formatHourLabel(11));
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editSlot, setEditSlot] = useState(null);

  const broadcastTimeSlotsUpdated = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('timeslots:updated'));
    try {
      window.localStorage.setItem('timeslots:lastUpdated', String(Date.now()));
    } catch (e) {
      // Ignore storage write issues.
    }
  };

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/v1/timeslots');
      setSlots(res.data.timeSlots || res.data || []);
    } catch (err) {
      console.error('Failed to load timeslots', err);
      toast.error('Failed to load TimeSlots');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await axios.post('/api/v1/timeslots', { hour: Number(hour), label });
      toast.success(res.data.message || 'TimeSlot created');
      const next = Math.min(23, Number(hour) + 1);
      setHour(next);
      setLabel(formatHourLabel(next));
      await fetchSlots();
      broadcastTimeSlotsUpdated();
    } catch (err) {
      console.error('Create failed', err);
      toast.error(err.response?.data?.error || 'Failed to create TimeSlot');
    } finally { setCreating(false); }
  };

  const openEdit = (slot) => { setEditSlot(slot); setEditOpen(true); };

  const handleUpdate = async () => {
    if (!editSlot) return;
    try {
      await axios.put(`/api/v1/timeslots/${editSlot._id}`, { label: editSlot.label, hour: Number(editSlot.hour) });
      toast.success('Updated');
      setEditOpen(false);
      await fetchSlots();
      broadcastTimeSlotsUpdated();
    } catch (err) {
      console.error('Update failed', err);
      toast.error('Failed to update TimeSlot');
    }
  };

  const toggleActive = async (id, current) => {
    try {
      await axios.put(`/api/v1/timeslots/${id}`, { isActive: !current });
      toast.success('Updated');
      await fetchSlots();
      broadcastTimeSlotsUpdated();
    } catch (err) {
      console.error('Update failed', err);
      toast.error('Failed to update TimeSlot');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <h2>TimeSlots (Admin)</h2>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setHour(11); setLabel(formatHourLabel(11)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          New
        </Button>
      </Box>

      <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 3 }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="hour-label">Hour</InputLabel>
          <Select labelId="hour-label" label="Hour" value={hour} onChange={(e) => { const v = Number(e.target.value); setHour(v); setLabel(formatHourLabel(v)); }}>
            {Array.from({ length: 13 - 11 }, (_, i) => 11 + i).map(h => (
              <MenuItem key={h} value={h}>{formatHourLabel(h)}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField label="Label" value={label} InputProps={{ readOnly: true }} />

        <Button variant="contained" type="submit" startIcon={<AddIcon />} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
      </Box>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Hour</TableCell>
            <TableCell>Label</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {slots.map(s => (
            <TableRow key={s._id}>
              <TableCell>{formatHourLabel(s.hour)}</TableCell>
              <TableCell>{s.label}</TableCell>
              <TableCell>
                <Switch checked={!!s.isActive} onChange={() => toggleActive(s._id, s.isActive)} icon={<ToggleOffIcon />} checkedIcon={<ToggleOnIcon />} />
              </TableCell>
              <TableCell>
                <IconButton onClick={() => openEdit(s)}><EditIcon /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Edit TimeSlot</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 320 }}>
          <FormControl>
            <InputLabel id="edit-hour-label">Hour</InputLabel>
            <Select labelId="edit-hour-label" label="Hour" value={editSlot?.hour || 11} onChange={(e) => setEditSlot(prev => ({ ...prev, hour: Number(e.target.value), label: formatHourLabel(Number(e.target.value)) }))}>
              {Array.from({ length: 13 - 11 }, (_, i) => 11 + i).map(h => (
                <MenuItem key={h} value={h}>{formatHourLabel(h)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField label="Label" value={editSlot?.label || ''} InputProps={{ readOnly: true }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>Active</span>
            <Switch checked={!!editSlot?.isActive} onChange={(e) => setEditSlot(prev => ({ ...prev, isActive: e.target.checked }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleUpdate}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DrawList;
