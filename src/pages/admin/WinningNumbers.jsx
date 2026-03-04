import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FaClock,
  FaCalendarAlt,
  FaSave,
  FaPlus,
  FaTrash,
  FaEdit,
  FaTrophy
} from 'react-icons/fa';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const WinningNumbers = () => {
  const [drawDate, setDrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [draws, setDraws] = useState([]);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [winningNumbers, setWinningNumbers] = useState([
    { number: "", type: "second", color: [0, 0, 255] }
  ]);
  const [existingWinningNumbers, setExistingWinningNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [editDraft, setEditDraft] = useState({ number: '', type: 'second' });

  // Fetch available draws for selection
  useEffect(() => {
    const fetchTimeSlots = async () => {
      try {
        // fetch all timeslots so we can show active and closed
        const res = await axios.get('/api/v1/timeslots');
        setDraws(res.data.timeSlots || res.data || []);
      } catch (err) {
        console.error('Failed to fetch timeslots', err);
        setDraws([]);
      }
    };
    fetchTimeSlots();
  }, []);

    const formatHourLabel = (h) => {
      if (h === null || typeof h === 'undefined') return '';
      const n = Number(h);
      if (Number.isNaN(n)) return String(h);
      if (n === 12) return '12PM';
      if (n === 0) return '12AM';
      const period = n >= 12 ? 'PM' : 'AM';
      const hour12 = ((n + 11) % 12) + 1;
      return `${hour12}${period}`;
    };

  const formatTimeSlotLabel = (slot) => {
    if (!slot) return '';
    if (typeof slot.hour === 'number' && !isNaN(slot.hour)) return formatHourLabel(slot.hour);
    if (slot.label && typeof slot.label === 'string') {
      // label expected like '23:00' or '11:00'
      const m = slot.label.match(/^(\d{1,2})/);
      if (m) return formatHourLabel(Number(m[1]));
      return slot.label;
    }
    if (slot.title && typeof slot.title === 'string') {
      const m = slot.title.match(/^(\d{1,2})/);
      if (m) return formatHourLabel(Number(m[1]));
      return slot.title;
    }
    return '';
  };

  const isSelectedDrawClosed = () => {
    if (!selectedDraw) return false;
    if (typeof selectedDraw.isActive === 'boolean') return selectedDraw.isActive === false;
    if (typeof selectedDraw.isExpired === 'boolean') return selectedDraw.isExpired === true;
    if (selectedDraw.status) return selectedDraw.status === 'closed';
    if (selectedDraw.draw_date) { const d = new Date(selectedDraw.draw_date); d.setHours(23,59,59,999); return Date.now() > d.getTime(); }
    return false;
  };

  // When a draw (timeslot) is selected, sync its date into drawDate (which drives winner fetch)
  useEffect(() => {
    if (selectedDraw && selectedDraw.draw_date) {
      const iso = new Date(selectedDraw.draw_date).toISOString().split('T')[0];
      setDrawDate(iso);
    }
  }, [selectedDraw]);

  // Fetch existing winning numbers when draw date changes
  useEffect(() => {
    if (drawDate) {
      fetchWinningNumbers();
    }
  }, [drawDate]);

  // Also refetch when timeslot selection changes
  useEffect(() => {
    if (selectedDraw) fetchWinningNumbers();
  }, [selectedDraw]);

  const fetchWinningNumbers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/v1/data/get-winning-numbers", {
        params: {
          date: drawDate,
          timeSlotId: selectedDraw?._id,
          timeSlot: selectedDraw?.label || (typeof selectedDraw?.hour !== 'undefined' ? formatHourLabel(selectedDraw.hour) : undefined)
        }
      });
  
      console.log("Fetched Winning Numbers:", response.data.winningNumbers);
      
      // Check if winningNumbers exist and is an array
      if (response.data.winningNumbers && Array.isArray(response.data.winningNumbers)) {
        const formattedNumbers = response.data.winningNumbers.map(item => ({
          number: item.number,
          type: item.type,
          color: item.type === 'first' ? [255, 0, 0] : 
                 item.type === 'second' ? [0, 0, 255] : 
                 [128, 0, 128] // Purple for third
        }));
        
        setExistingWinningNumbers(formattedNumbers);
        // keep add-form as a single blank row when existing winners are present
        setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
      } else {
        setExistingWinningNumbers([]);
        // Reset to default empty form
        setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
      }
    } catch (error) {
      console.error("Error fetching winning numbers:", error);
      if (error.response?.status !== 404) {
        toast.error("Failed to fetch winning numbers");
      }
      setExistingWinningNumbers([]);
      // Reset to a single blank add-form row on error
      setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
    } finally {
      setLoading(false);
    }
  };

  // Ensure numbers have color arrays for rendering
  const formatNumbers = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => ({
      number: item.number || '',
      type: item.type || 'second',
      color: item.color && Array.isArray(item.color) && item.color.length >= 3
        ? item.color
        : (item.type === 'first' ? [255,0,0] : item.type === 'second' ? [0,0,255] : [128,0,128])
    }));
  };

    const confirmDeleteSavedRow = async () => {
      if (deleteIndex === null) return;
      if (!isSelectedDrawClosed()) {
        toast.error('Draw is not close yet');
        setDeleteDialogOpen(false);
        setDeleteIndex(null);
        return;
      }
      try {
        setLoading(true);
        const remaining = (existingWinningNumbers || []).filter((_, i) => i !== deleteIndex);
        const response = await axios.put('/api/v1/data/update-winning-numbers', {
          date: drawDate,
          numbers: remaining,
          timeSlotId: selectedDraw?._id,
          timeSlot: selectedDraw?.label || selectedDraw?.hour
        });
        if (response.data && response.data.success) {
          toast.success('Row deleted');
          const formatted = formatNumbers(remaining);
          setExistingWinningNumbers(formatted);
          setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
        } else {
          toast.error(response.data?.error || 'Delete failed');
        }
      } catch (err) {
        console.error('Error deleting saved row', err);
        toast.error(err?.response?.data?.error || 'Failed to delete row');
      } finally {
        setLoading(false);
        setDeleteDialogOpen(false);
        setDeleteIndex(null);
      }
    };

    const openEditSavedRow = (index) => {
      setEditingIndex(index);
    };

    const openDeleteSavedRow = (index) => {
      setDeleteIndex(index);
      setDeleteDialogOpen(true);
    };

    // populate edit draft when editingIndex changes
    useEffect(() => {
      if (editingIndex === null) return;
      const item = (existingWinningNumbers && existingWinningNumbers[editingIndex]) || (winningNumbers && winningNumbers[editingIndex]) || { number: '', type: 'second' };
      setEditDraft({ number: item.number || '', type: item.type || 'second' });
    }, [editingIndex]);

    const closeEdit = () => setEditingIndex(null);

    const performUpdateSavedRow = async () => {
      if (editingIndex === null) return;
      if (!isSelectedDrawClosed()) {
        toast.error('Draw is not close yet');
        setEditingIndex(null);
        return;
      }
      try {
        setLoading(true);
        const updated = (existingWinningNumbers || []).slice();
        // if editing an index beyond existing, ensure array length
        if (editingIndex >= updated.length) {
          // extend with blanks
          while (updated.length <= editingIndex) updated.push({ number: '', type: 'second' });
        }
        updated[editingIndex] = { number: editDraft.number, type: editDraft.type };
        const response = await axios.put('/api/v1/data/update-winning-numbers', {
          date: drawDate,
          numbers: updated,
          timeSlotId: selectedDraw?._id,
          timeSlot: selectedDraw?.label || selectedDraw?.hour
        });
        if (response.data && response.data.success) {
          toast.success('Row updated');
            const formatted = formatNumbers(updated);
            setExistingWinningNumbers(formatted);
            setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
        } else {
          toast.error(response.data?.error || 'Update failed');
        }
      } catch (err) {
        console.error('Error updating saved row', err);
        toast.error(err?.response?.data?.error || 'Failed to update');
      } finally {
        setLoading(false);
        setEditingIndex(null);
      }
    };

  const sortedDraws = (draws || []).slice().sort((a, b) => {
    const ah = typeof a.hour !== 'undefined' ? Number(a.hour) : 0;
    const bh = typeof b.hour !== 'undefined' ? Number(b.hour) : 0;
    return ah - bh;
  });

  const handleNumberChange = (index, value) => {
    const updatedNumbers = [...winningNumbers];
    updatedNumbers[index].number = value;
    setWinningNumbers(updatedNumbers);
  };

  const handleTypeChange = (index, type) => {
    const updatedNumbers = [...winningNumbers];
    updatedNumbers[index].type = type;
    // Update color based on type
    if (type === "first") {
      updatedNumbers[index].color = [255, 0, 0]; // Red
    } else {
      updatedNumbers[index].color = [0, 0, 255]; // Blue
    }
    setWinningNumbers(updatedNumbers);
  };

  // single add-row mode: no addWinningNumber

  // single add-row mode: no removeWinningNumber

  const saveWinningNumbers = async () => {
    try {
      const validNumbers = winningNumbers.filter(item => item.number && String(item.number).trim() !== "");
      if (validNumbers.length === 0) {
        toast.error("Please enter at least one winning number");
        return;
      }

      // Validate number formats
      for (const item of validNumbers) {
        if (!/^\d+$/.test(String(item.number))) {
          toast.error(`Invalid number format: ${item.number}. Only digits are allowed.`);
          return;
        }
      }

      // Only allow saving when timeslot is closed
      if (!isSelectedDrawClosed()) {
        toast.error('Draw is not close yet');
        return;
      }

      // If there are existing winners, append (avoid duplicates)
      if (existingWinningNumbers && existingWinningNumbers.length > 0) {
        const existingSet = new Set((existingWinningNumbers || []).map(it => `${String(it.number)}-${it.type}`));
        const toAdd = [];
        for (const it of validNumbers) {
          const key = `${String(it.number)}-${it.type}`;
          if (!existingSet.has(key)) toAdd.push(it);
        }
        if (toAdd.length === 0) {
          toast.error('Number already exists');
          return;
        }
        const merged = [...existingWinningNumbers, ...toAdd];
        setLoading(true);
        const resp = await axios.put('/api/v1/data/update-winning-numbers', {
          date: drawDate,
          numbers: merged,
          timeSlotId: selectedDraw?._id,
          timeSlot: selectedDraw?.label || selectedDraw?.hour
        });
        if (resp.data && resp.data.success) {
          const formatted = formatNumbers(merged);
          setExistingWinningNumbers(formatted);
          setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
          toast.success('Winning numbers appended');
        } else {
          toast.error(resp.data?.error || 'Append failed');
        }
      } else {
        const response = await axios.post("/api/v1/data/set-winning-numbers", {
          date: drawDate,
          winningNumbers: validNumbers,
          timeSlotId: selectedDraw?._id,
          timeSlot: selectedDraw?.label || selectedDraw?.hour
        });

        console.log('set-winning-numbers response:', response.data);
        if (response.data && (response.data.success || response.data.message)) {
          toast.success(response.data.message || "Winning numbers saved successfully!");
          const formatted = formatNumbers(validNumbers);
          setExistingWinningNumbers(formatted);
          setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
        }
      }
    } catch (error) {
      console.error("Error saving winning numbers:", error);
      const errMsg = error.response?.data?.error || error.message;
      if (errMsg && String(errMsg).toLowerCase().includes('already set')) {
        toast('Winning numbers already exist — updating instead');
        await updateWinningNumbers();
        return;
      }
      toast.error(errMsg || "Failed to save winning numbers");
    } finally {
      setLoading(false);
    }
  };

  const updateWinningNumbers = async () => {
    try {
      const validNumbers = winningNumbers.filter(item => item.number.trim() !== "");
      
      if (validNumbers.length === 0) {
        toast.error("Please enter at least one winning number");
        return;
      }

      // Only allow updating when timeslot is closed
      if (!isSelectedDrawClosed()) {
        toast.error('Draw is not close yet');
        return;
      }

      setLoading(true);

      const response = await axios.put("/api/v1/data/update-winning-numbers", {
        date: drawDate,
        numbers: validNumbers,
        timeSlotId: selectedDraw?._id,
        timeSlot: selectedDraw?.label || selectedDraw?.hour
      });

      if (response.data.success) {
        toast.success("Winning numbers updated successfully!");
        const formatted = formatNumbers(validNumbers);
        setExistingWinningNumbers(formatted);
        setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
      }
    } catch (error) {
      console.error("Error updating winning numbers:", error);
      toast.error(error.response?.data?.error || "Failed to update winning numbers");
    } finally {
      setLoading(false);
    }
  };

  const deleteWinningNumbers = async () => {
    if (!window.confirm("Are you sure you want to delete these winning numbers?")) {
      return;
    }

    try {
      setLoading(true);

      // Only allow delete when timeslot is closed
      if (!isSelectedDrawClosed()) {
        toast.error('Draw is not close yet');
        setLoading(false);
        return;
      }

      const response = await axios.delete("/api/v1/data/delete-winning-numbers", {
        params: {
          date: drawDate,
          timeSlotId: selectedDraw?._id,
          timeSlot: selectedDraw?.label || (typeof selectedDraw?.hour !== 'undefined' ? formatHourLabel(selectedDraw.hour) : undefined)
        }
      });

      if (response.data.success) {
        toast.success("Winning numbers deleted successfully!");
        setExistingWinningNumbers([]);
        setWinningNumbers([{ number: '', type: 'second', color: [0,0,255] }]);
      }
    } catch (error) {
      console.error("Error deleting winning numbers:", error);
      toast.error(error.response?.data?.error || "Failed to delete winning numbers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setDeleteIndex(null); }}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>Are you sure you want to delete this winning number?</DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setDeleteIndex(null); }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDeleteSavedRow} disabled={loading}>Delete</Button>
        </DialogActions>
      </Dialog>
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Paper sx={{ bgcolor: 'grey.900', color: 'common.white', p: 3, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
        <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
          <FaTrophy style={{ color: '#F6C000', marginRight: 8 }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            Winning Numbers Management
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <FaCalendarAlt style={{ color: '#9C27B0' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Draw Date:</Typography>
              <TextField
                size="small"
                type="date"
                value={drawDate}
                onChange={(e) => { setDrawDate(e.target.value); setSelectedDraw(null); }}
                sx={{ bgcolor: 'grey.800', input: { color: 'common.white' }, borderRadius: 1 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <FaClock style={{ color: '#9C27B0' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Select TimeSlot:</Typography>
              <FormControl size="small" sx={{ minWidth: 240, bgcolor: 'grey.800', borderRadius: 1 }}>
                <Select
                  displayEmpty
                  value={selectedDraw?._id || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const draw = draws.find(d => String(d._id) === String(value));
                    setSelectedDraw(draw || null);
                  }}
                  sx={{ color: 'common.white' }}
                >
                  <MenuItem value="">-- Select TimeSlot --</MenuItem>
                  {sortedDraws.length > 0 ? (
                    sortedDraws.map((draw) => {
                      const label = formatTimeSlotLabel(draw) || draw.title || draw.label || 'Timeslot';
                      const closed = (typeof draw.isActive !== 'undefined') ? (draw.isActive === false) : (draw.isExpired || draw.status === 'closed');
                      const labelText = `${label} ${closed ? '(Closed)' : '(Active)'}`;
                      return (
                        <MenuItem key={draw._id} value={draw._id} sx={{ opacity: closed ? 0.6 : 1 }}>
                          {labelText}
                        </MenuItem>
                      );
                    })
                  ) : (
                    // fallback: show hours 11AM..11PM if no timeslots returned
                    Array.from({ length: 13 }, (_, i) => 11 + i).map(h => (
                      <MenuItem key={`h-${h}`} value="" disabled>
                        {formatHourLabel(h)}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Box>
          </Grid>
        </Grid>

        {/* Existing Winning Numbers Display */}
        {existingWinningNumbers.length > 0 && (
          <Paper sx={{ bgcolor: 'grey.800', color: 'common.white', p: 2, mb: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box display="flex" alignItems="center" mb={1}>
                  <FaTrophy style={{ color: '#4CAF50', marginRight: 8 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Current Winning Numbers for {selectedDraw ? (formatTimeSlotLabel(selectedDraw) || selectedDraw.title || selectedDraw.label || drawDate) : drawDate}
                </Typography>
                <Box sx={{ ml: 2 }}>
                  {selectedDraw && (
                    <Typography variant="caption" sx={{ color: isSelectedDrawClosed() ? '#fff' : '#000', bgcolor: isSelectedDrawClosed() ? '#4CAF50' : '#f57c00', px:1, py:0.5, borderRadius:1 }}>
                      {isSelectedDrawClosed() ? 'Closed' : 'Active'}
                    </Typography>
                  )}
                </Box>
              </Box>

            <Grid container spacing={2}>
              {existingWinningNumbers.map((item, index) => (
                  <Grid item xs={12} md={4} key={index}>
                    <Paper sx={{ p: 2, bgcolor: 'grey.700', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})` }}>
                            {item.number}
                          </Typography>
                          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'grey.300' }}>{item.note || ''}</Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1,
                              backgroundColor: item.type === 'first' ? '#e53935' : item.type === 'second' ? '#1e88e5' : '#8e24aa',
                              color: '#fff'
                            }}
                          >
                            {item.type.toUpperCase()}
                          </Typography>

                          <IconButton size="small" color="primary" onClick={() => openEditSavedRow(index)} aria-label={`edit-saved-${index}`} disabled={!isSelectedDrawClosed()}>
                            <FaEdit />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => openDeleteSavedRow(index)} aria-label={`delete-saved-${index}`} disabled={!isSelectedDrawClosed()}>
                            <FaTrash />
                          </IconButton>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* Inform to select a TimeSlot first */}
        {!selectedDraw && (
          <Box mb={2}>
            <Alert severity="info">Please select a TimeSlot first to add or save winning numbers.</Alert>
          </Box>
        )}

        {/* Winning Numbers Input Form - always visible */}
        <Paper sx={{ bgcolor: 'grey.800', color: 'common.white', p: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <FaPlus style={{ color: '#2196F3', marginRight: 8 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Winning Numbers for {selectedDraw ? (selectedDraw.label || (typeof selectedDraw.hour !== 'undefined' ? formatHourLabel(selectedDraw.hour) : (selectedDraw.title || drawDate))) : drawDate}</Typography>
          </Box>

          <Grid container spacing={2}>
            {winningNumbers.map((item, index) => (
              <Grid item xs={12} key={index}>
                <Paper sx={{ p: 1.25, bgcolor: 'grey.800', border: editingIndex === index ? '1px solid rgba(144,202,249,0.4)' : '1px solid rgba(255,255,255,0.04)', boxShadow: editingIndex === index ? '0 0 0 3px rgba(144,202,249,0.04)' : 'none' }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <TextField
                        label="Number"
                        size="small"
                        fullWidth
                        value={item.number}
                        onChange={(e) => handleNumberChange(index, e.target.value)}
                        sx={{ bgcolor: 'grey.700' }}
                        inputProps={{ style: { color: '#fff' } }}
                      />
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <FormControl size="small" fullWidth sx={{ bgcolor: 'grey.700' }}>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Type</InputLabel>
                        <Select
                          label="Type"
                          value={item.type}
                          onChange={(e) => handleTypeChange(index, e.target.value)}
                          sx={{ color: 'common.white' }}
                        >
                          <MenuItem value="first">First Prize</MenuItem>
                          <MenuItem value="second">Second Prize</MenuItem>
                          <MenuItem value="third">Third Prize</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Box sx={{ p: 1, borderRadius: 1, bgcolor: `rgba(${item.color[0]}, ${item.color[1]}, ${item.color[2]}, 0.12)`, color: `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`, textAlign: 'center', fontWeight: 700 }}> {item.number || 'Preview'} </Box>
                    </Grid>

                    {/* single add-row: no per-row remove button */}
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Box mt={2} display="flex" gap={2}>
            <Button variant="contained" color="primary" startIcon={<FaSave />} onClick={saveWinningNumbers} disabled={loading || !selectedDraw || !isSelectedDrawClosed()}>{loading ? 'Saving...' : 'Save Winning Numbers'}</Button>
          </Box>
        </Paper>

        {/* Instructions */}
        <Paper sx={{ bgcolor: 'grey.800', color: 'common.white', p: 2, mt: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Instructions:</Typography>
          <Box component="ul" sx={{ pl: 2, color: 'grey.300' }}>
            <li><strong>First Prize:</strong> Red color - Main winning number</li>
            <li><strong>Second Prize:</strong> Blue color - Secondary winning numbers</li>
            <li><strong>Third Prize:</strong> Purple color - Third tier winning numbers</li>
            <li>You can add multiple winning numbers for each timeslot</li>
            <li>Numbers should contain only digits (0-9)</li>
            <li>Each timeslot can have different winning numbers</li>
            <li>Changes will be reflected in user vouchers and ledgers immediately</li>
          </Box>
        </Paper>
      </Paper>
    </Container>

    {/* Edit Dialog for saved row */}
    <Dialog open={editingIndex !== null} onClose={() => setEditingIndex(null)} fullWidth maxWidth="sm">
      <DialogTitle>Edit Winning Number</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <TextField label="Number" fullWidth size="small" value={editDraft.number} onChange={(e) => setEditDraft({ ...editDraft, number: e.target.value })} sx={{ mb: 2 }} />
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select value={editDraft.type} label="Type" onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })}>
              <MenuItem value="first">First Prize</MenuItem>
              <MenuItem value="second">Second Prize</MenuItem>
              <MenuItem value="third">Third Prize</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditingIndex(null)}>Cancel</Button>
        <Button variant="contained" onClick={performUpdateSavedRow} disabled={loading}>Save</Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default WinningNumbers;
