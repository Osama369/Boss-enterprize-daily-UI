import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Sidebar from "../../components/Sidebar";
import CompactHeader from '../../components/CompactHeader';

const AdminLayout = () => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const drawerWidth = 240;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarVisible && <Sidebar onSelect={() => {}} />}

      <Box component="main" sx={{ flexGrow: 1, ml: sidebarVisible ? `${drawerWidth}px` : 0 }}>
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
