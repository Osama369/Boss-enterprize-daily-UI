import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Sidebar from "../../components/Sidebar";
import CompactHeader from '../../components/CompactHeader';

const AdminLayout = () => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const drawerWidth = 240;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isDesktop ? (
        sidebarVisible && (
          <Sidebar
            onSelect={() => {}}
            variant="permanent"
          />
        )
      ) : (
        <Sidebar
          onSelect={() => {}}
          variant="temporary"
          open={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
        />
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <CompactHeader drawerWidth={drawerWidth} sidebarVisible={sidebarVisible} onToggleSidebar={() => setSidebarVisible(v => !v)} />
        <Toolbar />
        <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
