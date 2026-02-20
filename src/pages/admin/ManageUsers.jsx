import React, { useState, useEffect } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { showLoading, hideLoading } from "../../redux/features/alertSlice";
import toast from 'react-hot-toast';
import UserTable from "../../components/UserTable";
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const [showOnlyDistributors, setShowOnlyDistributors] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUser, setTransferUser] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const res = await axios.get("/api/v1/users/");

      setUsers(res.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      const msg = err.response?.data?.message || "Failed to load users";
      setError(msg);
      toast.error(msg);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      dispatch(showLoading());
      const user = users.find(user => user._id === id);
      if (!user) {
        toast.error("User not found");
        return;
      }
      const newStatus = !user.isActive;
      await axios.patch(
        `/api/v1/users/${id}/active`,
        { isActive: newStatus }
      );

      setUsers(prevUsers => prevUsers.map(u => u._id === id ? { ...u, isActive: newStatus } : u));
      toast.success(`User status updated to ${newStatus ? 'active' : 'inactive'}`);
    } catch (err) {
      console.error("Error updating user status:", err);
      const msg = err.response?.data?.message || "Failed to update user status";
      toast.error(msg);
    } finally {
      dispatch(hideLoading());
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      dispatch(showLoading());
      await axios.delete(`/api/v1/users/${id}`);
      setUsers(prevUsers => prevUsers.filter(user => user._id !== id));
      toast.success("User deleted successfully");
    } catch (err) {
      console.error("Error deleting user:", err);
      const msg = err.response?.data?.message || "Failed to delete user";
      toast.error(msg);
    } finally {
      dispatch(hideLoading());
    }
  };

  const openTransferModal = (user) => {
    setTransferUser(user);
    setTransferAmount('');
    setTransferOpen(true);
  };

  const closeTransferModal = () => {
    if (transferLoading) return;
    setTransferOpen(false);
    setTransferUser(null);
    setTransferAmount('');
  };

  const generateIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const handleTransferSubmit = async () => {
    if (!transferUser) return;
    const amt = Number(transferAmount || 0);
    if (!amt || amt <= 0) {
      toast.error('Enter a positive amount');
      return;
    }

    setTransferLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey();

      const res = await axios.post(
        `/api/v1/users/${transferUser._id}/balance/transfer`,
        { amount: amt },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      const targetBalance = res.data?.targetBalance;
      setUsers(prevUsers =>
        prevUsers.map(u => (u._id === transferUser._id ? { ...u, balance: targetBalance } : u))
      );

      toast.success('Transfer successful');
      closeTransferModal();
    } catch (err) {
      console.error('Transfer error:', err);
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);
  
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">Manage Users</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1}>
          <Button variant={showOnlyDistributors ? 'contained' : 'outlined'} onClick={() => setShowOnlyDistributors(true)}>Distributors</Button>
          <Button variant={!showOnlyDistributors ? 'contained' : 'outlined'} onClick={() => setShowOnlyDistributors(false)}>All users</Button>
        </Stack>
        {isLoading && <CircularProgress size={24} />}
      </Box>

      {!isLoading && (!users || users.length === 0) ? (
        <Alert severity="warning">No users found.</Alert>
      ) : (
        <UserTable
          users={users}
          toggleStatus={toggleStatus}
          deleteUser={deleteUser}
          showOnlyDistributors={showOnlyDistributors}
          onTransfer={openTransferModal}
        />
      )}

      <Dialog open={transferOpen} onClose={closeTransferModal} maxWidth="xs" fullWidth>
        <DialogTitle>
          {transferUser ? `Transfer Balance to ${transferUser.username}` : 'Transfer Balance'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Current balance: <strong>{transferUser?.balance ?? 0}</strong>
          </Typography>
          <TextField
            autoFocus
            fullWidth
            type="number"
            label="Amount"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            inputProps={{ min: 0 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTransferModal} disabled={transferLoading}>Cancel</Button>
          <Button onClick={handleTransferSubmit} variant="contained" disabled={transferLoading}>
            {transferLoading ? 'Transferring...' : 'Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ManageUsers;
