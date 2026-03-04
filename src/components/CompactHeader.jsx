import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaEllipsisH, FaSignOutAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { clearUser } from '../redux/features/userSlice';
import axios from 'axios';
import toast from 'react-hot-toast';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const CompactHeader = ({ onToggleSidebar }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userData = useSelector((s) => s.user);

  const handleLogout = async () => {
    try {
      await axios.post('/api/v1/auth/logout');
    } catch (err) {
      console.warn('Server logout failed', err?.message || err);
    }
    dispatch(clearUser());
    toast.success('Logged out');
    navigate(userData?.user?.role === 'admin' ? '/admin-login' : '/login');
  };

  const roleRaw = userData?.user?.role || '';
  const roleLabel = typeof roleRaw === 'string' && roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1) : 'User';

  return (
    <AppBar
      position="fixed"
      sx={{
        left: 0,
        width: '100%',
        zIndex: (muiTheme) => muiTheme.zIndex.drawer + 2,
        backgroundColor: 'transparent',
        boxShadow: 'none',
      }}
    >
      <Toolbar
        sx={{
          bgcolor: 'grey.800',
          color: 'common.white',
          px: { xs: 1.25, sm: 2 },
          py: 1,
          borderRadius: 1.5,
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: '56px',
        }}
      >
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <IconButton
            onClick={() => { if (typeof onToggleSidebar === 'function') onToggleSidebar(); }}
            color="inherit"
            size="small"
            aria-label="toggle sidebar"
            sx={{
              bgcolor: 'grey.900',
              width: 40,
              height: 40,
              borderRadius: 1.5,
              border: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
              '&:hover': { bgcolor: 'grey.700' },
            }}
          >
            <FaEllipsisH style={{ fontSize: 14 }} />
          </IconButton>

          <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', color: 'common.white' }}>
            <Typography variant="body2" noWrap sx={{ color: 'common.white', fontWeight: 600 }}>
              {`${roleLabel} - ${userData?.user?.dealerId || '-'} - ${userData?.user?.username || ''}`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'common.white', opacity: 0.8 }}>
              {roleLabel}
            </Typography>
          </Box>

          <IconButton onClick={handleLogout} color="inherit" size="small" title="Logout" aria-label="logout" sx={{ flexShrink: 0 }}>
            <FaSignOutAlt />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default CompactHeader;
