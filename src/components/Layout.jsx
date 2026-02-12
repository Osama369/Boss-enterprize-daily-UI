import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// import axios from "axios";
// import jsPDF from "jspdf";
// import { useSelector, useDispatch } from "react-redux";
// import { showLoading, hideLoading } from '../redux/features/alertSlice';
// import { setUser } from '../redux/features/userSlice';
// imort the FaSignOutAlt
import { FaFile, FaSignOutAlt } from 'react-icons/fa';
// import { setData } from '../redux/features/dataSlice';
import toast from 'react-hot-toast';
import Center from './Center';

import DistributerUsers from '../pages/distributor/DistributerUsers';
import DistributorCreateUser from '../pages/distributor/DistributorCreateUser';
import DistributorEditUser from '../pages/distributor/DistributorEditUser'; // Import the edit user component
import Spinner from '../components/Spinner'
import "jspdf-autotable";
import {
  FaBook,
  FaCalculator,
  FaInbox,
  FaDice,
  FaUsers,
  FaUserPlus,
  FaFileAlt,
  FaUserEdit, // Import icon for editing users
} from 'react-icons/fa';
import RoleBasedComponent from './RoleBasedRoute';
import { Link } from 'react-router-dom';
import Reports from './Reports';
import CompactHeader from './CompactHeader';
import TotalSaleReport from './TotalSaleReport';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
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
  // const userData = useSelector((state) => state.user);
  // const token = userData?.token || localStorage.getItem("token");
  // console.log(token);


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
  
   
//    // logout th user 
//    // utils/auth.js (or inside any component)

const handleLogout = (navigate) => {
  localStorage.removeItem("token");
  localStorage.removeItem("user"); // if you're storing user info
  // Optionally show a toast
  toast.success("Logged out successfully!");
  // Navigate to login
  navigate("/login");
};


 
  const [activeTab, setActiveTab] = useState("Sell Department");
  const [selectedUserId, setSelectedUserId] = useState(null); // Add state for selected user ID
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const drawerWidth = 240;

  // Keep layout in sync with URL so routes like /manage-users render inside the dashboard
  useEffect(() => {
    const path = location.pathname || '';
    // support both top-level and /distributor-prefixed routes
    if (path === '/manage-users' || path === '/distributor/manage-users') {
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
      {sidebarVisible && <Sidebar onSelect={(tab) => setActiveTab(tab)} />}

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'transparent', ml: sidebarVisible ? `${drawerWidth}px` : 0 }}>
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


