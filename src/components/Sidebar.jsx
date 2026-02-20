import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ReportIcon from '@mui/icons-material/Report';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

const drawerWidth = 240;

// Sidebar shows different menu items depending on the user's role.
// onSelect(tab) will be called for layout-local tabs (Sell Department, reports, total-sale-report, etc.).
const Sidebar = ({ onSelect, variant = 'permanent', open = true, onClose = null }) => {
  const user = useSelector((s) => s.user?.user);
  const role = user?.role || 'user';

  const handleSelect = (tab) => {
    if (typeof onSelect === 'function') onSelect(tab);
    if (variant !== 'permanent' && typeof onClose === 'function') onClose();
  };

  const closeIfOverlay = () => {
    if (variant !== 'permanent' && typeof onClose === 'function') onClose();
  };

  return (
    <Drawer
      variant={variant}
      open={variant === 'permanent' ? true : open}
      onClose={onClose || undefined}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: 'grey.800',
          color: 'common.white',
          p: 1,
          borderRadius: variant === 'permanent' ? 1.5 : 0,
          border: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ color: 'common.white', fontWeight: 700 }}>Dealer Portal</Typography>
      </Toolbar>
      <Box sx={{ overflow: 'auto', p: 1 }}>
        <List>
          {/* Sell Department - hide for admin (admin has its own panel) */}
          {role !== 'admin' && (
            <>
              {role === 'distributor' ? (
                <>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/distributor/book" onClick={closeIfOverlay}>
                      <ListItemIcon><MonetizationOnIcon /></ListItemIcon>
                      <ListItemText primary="Sell Department" />
                    </ListItemButton>
                  </ListItem>

                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/distributor/voucher" onClick={closeIfOverlay}>
                      <ListItemIcon><DashboardIcon /></ListItemIcon>
                      <ListItemText primary="Sale Vouchers" />
                    </ListItemButton>
                  </ListItem>

                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/distributor/sale-report" onClick={closeIfOverlay}>
                      <ListItemIcon><ReportIcon /></ListItemIcon>
                      <ListItemText primary="Total Sale Report" />
                    </ListItemButton>
                  </ListItem>
                </>
              ) : (
                <>
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => handleSelect('Sell Department')}>
                      <ListItemIcon><MonetizationOnIcon /></ListItemIcon>
                      <ListItemText primary="Sell Department" />
                    </ListItemButton>
                  </ListItem>

                  {/* Common reports for users+distributors */}
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => handleSelect('reports')}>
                      <ListItemIcon><DashboardIcon /></ListItemIcon>
                      <ListItemText primary="Sale Vouchers" />
                    </ListItemButton>
                  </ListItem>

                  <ListItem disablePadding>
                    <ListItemButton onClick={() => handleSelect('total-sale-report')}>
                      <ListItemIcon><ReportIcon /></ListItemIcon>
                      <ListItemText primary="Total Sale Report" />
                    </ListItemButton>
                  </ListItem>
                </>
              )}
            </>
          )}

          {/* Distributor & Admin specific items */}
          {(role === 'distributor' || role === 'admin') && (
            <>
              {role === 'admin' ? (
                <>
                  <ListItem disablePadding>
                  <ListItemButton component={Link} to="/admin/manage-users" onClick={closeIfOverlay}>
                      <ListItemIcon><GroupIcon /></ListItemIcon>
                      <ListItemText primary="Manage Users" />
                    </ListItemButton>
                  </ListItem>

                  <ListItem disablePadding>
                  <ListItemButton component={Link} to="/admin/create-user" onClick={closeIfOverlay}>
                      <ListItemIcon><PersonAddIcon /></ListItemIcon>
                      <ListItemText primary="Create User" />
                    </ListItemButton>
                  </ListItem>

                </>
              ) : (
                <>
                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/distributor/manage-users" onClick={closeIfOverlay}>
                      <ListItemIcon><GroupIcon /></ListItemIcon>
                      <ListItemText primary="Manage Users" />
                    </ListItemButton>
                  </ListItem>

                  <ListItem disablePadding>
                    <ListItemButton component={Link} to="/distributor/create-user" onClick={closeIfOverlay}>
                      <ListItemIcon><PersonAddIcon /></ListItemIcon>
                      <ListItemText primary="Create User" />
                    </ListItemButton>
                  </ListItem>
                </>
              )}
            </>
          )}

          {/* (common reports are rendered above for non-admin roles) */}

          {/* Admin pages */}
          {role === 'admin' && (
            <>
              <ListItem disablePadding>
                <ListItemButton component={Link} to="/admin/winning-numbers" onClick={closeIfOverlay}>
                  <ListItemIcon><EmojiEventsIcon /></ListItemIcon>
                  <ListItemText primary="Winning Numbers" />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton component={Link} to="/admin/timeslots" onClick={closeIfOverlay}>
                  <ListItemIcon><ScheduleIcon /></ListItemIcon>
                  <ListItemText primary="TimeSlots" />
                </ListItemButton>
              </ListItem>
            </>
          )}

        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
