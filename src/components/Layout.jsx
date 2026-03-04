import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Center from './Center';

import DistributerUsers from '../pages/distributor/DistributerUsers';
import DistributorCreateUser from '../pages/distributor/DistributorCreateUser';
import DistributorEditUser from '../pages/distributor/DistributorEditUser'; // Import the edit user component
import "jspdf-autotable";
import Reports from './Reports';
import CompactHeader from './CompactHeader';
import TotalSaleReport from './TotalSaleReport';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Sidebar from './Sidebar';
const Layout = () => {
  // Hooks to manage states of the variables
  // State for ledger selection, date, and draw time
  //const [user, setUser] = useState(null);
  // using the redux slice reducer

  // const dispatch = useDispatch();
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();


  // const [ledger, setLedger] = useState("LEDGER");
  // const [drawTime, setDrawTime] = useState("11 AM");  // time slot
  // const [drawDate, setDrawDate] = useState(new Date().toISOString().split('T')[0]); // date
  // const [closingTime, setClosingTime] = useState("");
  // const [entries, setEntries] = useState([]);  // table entries
  // const [no, setNo] = useState('');
  // const [f, setF] = useState('');
  // const [s, setS] = useState('');
  // const [selectAll, setSelectAll] = useState(false);
  // const [currentTime, setCurrentTime] = useState(new Date());
  // const [file, setFile] = useState(null);
  
   
  const [activeTab, setActiveTab] = useState("Sell Department");
  const [selectedUserId, setSelectedUserId] = useState(null); // Add state for selected user ID
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const drawerWidth = 240;
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  // Keep layout in sync with URL so routes like /manage-users render inside the dashboard
  useEffect(() => {
    const path = location.pathname || '';
    // support both top-level and /distributor-prefixed routes
    if (path === '/' || path === '/book' || path === '/distributor' || path === '/distributor/book') {
      setActiveTab('Sell Department');
    } else if (path === '/voucher' || path === '/distributor/voucher') {
      setActiveTab('reports');
    } else if (path === '/sale-report' || path === '/distributor/sale-report') {
      setActiveTab('total-sale-report');
    } else if (path === '/manage-users' || path === '/distributor/manage-users') {
      setActiveTab('manage-users');
    } else if (path === '/create-user' || path === '/distributor/create-user') {
      setActiveTab('create-user');
    } else if (
      path.startsWith('/edit-user/') ||
      path.startsWith('/distributor/edit-user/') ||
      path.startsWith('/manage-users/') ||
      path.startsWith('/distributor/manage-users/')
    ) {
      // extract id (last segment)
      const parts = path.split('/');
      const id = parts[parts.length - 1] || null;
      if (id) {
        setSelectedUserId(id);
        setActiveTab('edit-user');
      }
    }
  }, [location.pathname]);


  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.900', color: 'grey.100' }}>

      {/* Sidebar */}
      {isDesktop ? (
        sidebarVisible && (
          <Sidebar
            onSelect={(tab) => setActiveTab(tab)}
            variant="permanent"
          />
        )
      ) : (
        <Sidebar
          onSelect={(tab) => setActiveTab(tab)}
          variant="temporary"
          open={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
        />
      )}

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, bgcolor: 'transparent' }}>
        <CompactHeader
          drawerWidth={drawerWidth}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={() => setSidebarVisible(v => !v)}
        />
        <Toolbar />
        {activeTab === "Sell Department" && <Center onToggleSidebar={() => setSidebarVisible(v => !v)} sidebarVisible={sidebarVisible} />}
       {/* {activeTab === "Purchase Department" && <PurchaseDepartment />} */}
        {activeTab === "manage-users" && <DistributerUsers onEditUser={(userId) => {
          console.log("Editing user with ID:", userId);
          setSelectedUserId(userId);
          setActiveTab("edit-user");
          // navigate to a distributor-prefixed URL if current location uses distributor prefix
          const useDistributorPrefix = location.pathname.startsWith('/distributor');
          const base = useDistributorPrefix ? '/distributor/manage-users' : '/manage-users';
          navigate(`${base}/${userId}`);
        }}/>} 
        { /* Party management removed; use Users management instead */ }
        {activeTab === "create-user" && <DistributorCreateUser theme="dark" />}
        {activeTab === "edit-user" && <DistributorEditUser userId={selectedUserId} theme="dark" />}
        {activeTab === "reports" && <Reports />}
        {activeTab === "total-sale-report" && <TotalSaleReport />}
        { /* Emails / archives removed */ }
      </Box>
    </Box>
  );
};

export default Layout;


