import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaEllipsisH, FaSignOutAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../redux/features/userSlice';
import axios from 'axios';
import toast from 'react-hot-toast';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const CompactHeader = ({ onToggleSidebar, drawerWidth = 240, sidebarVisible = true }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const reduxUserSlice = useSelector((s) => s.user);
  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch (e) {
    storedUser = null;
  }
  const adminTokenPresent = !!localStorage.getItem('adminToken');
  const userData = reduxUserSlice || (storedUser ? { user: storedUser } : (adminTokenPresent ? { user: { username: 'admin', dealerId: '' } } : null));

  const handleLogout = async () => {
    try {
      dispatch(setUser(null));
    } catch (err) {
      // ignore
    }

    const isAdmin = adminTokenPresent;
    const tokenKey = isAdmin ? 'adminToken' : 'token';
    const endpoint = isAdmin ? '/api/v1/auth/admin-logout' : '/api/v1/auth/logout';
    const token = localStorage.getItem(tokenKey);

    // Attempt server-side logout (best-effort)
    try {
      if (token) {
        await axios.post(endpoint, {}, { headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (err) {
      // ignore server logout errors — continue to clear local state
      console.warn('Server logout failed', err?.message || err);
    }

    // Clear local tokens and user info
    localStorage.removeItem(tokenKey);
    localStorage.removeItem('user');
    // also clear any other role token keys
    localStorage.removeItem('distributorToken');

    toast.success('Logged out');

    // Redirect to appropriate login
    navigate(isAdmin ? '/admin-login' : '/login');
  };

  const roleRaw = adminTokenPresent ? 'admin' : (reduxUserSlice?.user?.role || storedUser?.role || '');
  const roleLabel = typeof roleRaw === 'string' && roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1) : 'User';

  return (
    <AppBar
      position="fixed"
      sx={{
        left: sidebarVisible ? `${drawerWidth}px` : 0,
        width: sidebarVisible ? `calc(100% - ${drawerWidth}px)` : '100%',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'transparent',
        boxShadow: 'none',
      }}
    >
      <Toolbar sx={{ bgcolor: 'grey.800', color: 'common.white', p: 1.25, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
        <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <IconButton
          onClick={() => { if (typeof onToggleSidebar === 'function') onToggleSidebar(); }}
          color="inherit"
          size="small"
          aria-label="toggle sidebar"
          sx={{
            position: 'absolute',
            left: '-16%',
            top: -10,
            transform: 'translateX(-50%)',
            bgcolor: 'grey.900',
            width: 64,
            height: 64,
            boxShadow: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.04)',
            zIndex: 1400,
            '&:hover': { bgcolor: 'grey.800' }
          }}
        >
          <FaEllipsisH style={{ fontSize: 22 }} />
        </IconButton>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', color: 'common.white' }}>
          <Typography variant="body2" sx={{ color: 'common.white', fontWeight: 600 }}>
            {`${roleLabel} - ${userData?.user?.dealerId || '—'} - ${userData?.user?.username || ''}`}
          </Typography>
          <Typography variant="caption" sx={{ color: 'common.white', opacity: 0.8 }}>
            {roleLabel}
          </Typography>
        </Box>

          <IconButton onClick={handleLogout} color="inherit" size="small" title="Logout" aria-label="logout">
            <FaSignOutAlt />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default CompactHeader;
