import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { showLoading, hideLoading } from '../../redux/features/alertSlice';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';

const DistributerUsers = ({ onEditUser }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const isMounted = useRef(true);

  // Fetch users created by the distributor
  const fetchDistributorUsers = async () => {
    try {
      // dispatch(showLoading());
      setError(null);
      const response = await axios.get("/api/v1/users/distributor-users");
      
      if (isMounted.current) {
        if (Array.isArray(response.data)) {
          setUsers(response.data);
        } else {
          console.error("Unexpected data format:", response.data);
          setError("Received invalid data format from server");
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      if (isMounted.current) {
        setError(error.response?.data?.message || "Failed to load users");
        toast.error(error.response?.data?.message || "Failed to load users");
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        // dispatch(hideLoading());
      }
    }
  };

  // Toggle user active status
  const toggleStatus = async (id) => {
    try {
      // dispatch(showLoading());
      
      const user = users.find(user => user._id === id);
      if (!user) {
        toast.error("User not found");
        return;
      }
      
      const newStatus = !user.isActive;
      // Use distributor update endpoint so distributors can toggle their clients
      await axios.patch(
        `/api/v1/users/distributor-update/${id}`,
        { isActive: newStatus }
      );
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user._id === id ? { ...user, isActive: newStatus } : user
        )
      );
      
      toast.success(`User status updated to ${newStatus ? 'active' : 'inactive'}`);
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error(error.response?.data?.message || "Failed to update user status");
    } finally {
      // dispatch(hideLoading());
    }
  };

  // Delete user
  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }
    
    try {
      // dispatch(showLoading());
      
      // Use distributor-specific delete route (admin delete is protected)
      await axios.delete(`/api/v1/users/distributor-delete/${id}`);
      
      // Remove user from local state
      setUsers(prevUsers => prevUsers.filter(user => user._id !== id));
      toast.success("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.message || "Failed to delete user");
    } finally {
      // dispatch(hideLoading());
    }
  };

  // Transfer modal state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUser, setTransferUser] = useState(null);
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferLoading, setTransferLoading] = useState(false);

  const openTransferModal = (user) => {
    setTransferUser(user);
    setTransferAmount(0);
    setTransferOpen(true);
  };

  const closeTransferModal = () => {
    setTransferOpen(false);
    setTransferUser(null);
    setTransferAmount(0);
    setTransferLoading(false);
  };

  const generateIdempotencyKey = () => {
    // simple unique key
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

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
      const res = await axios.post(`/api/v1/users/${transferUser._id}/balance/transfer`, { amount: amt }, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        }
      });

      const senderBalance = res.data.senderBalance;
      const targetBalance = res.data.targetBalance;

      // Update local users list: update target user's balance
      setUsers(prev => prev.map(u => u._id === transferUser._id ? { ...u, balance: targetBalance } : u));

      toast.success('Transfer successful');
      closeTransferModal();
    } catch (err) {
      console.error('Transfer error:', err);
      const msg = err.response?.data?.error || 'Transfer failed';
      toast.error(msg);
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    // Set up cleanup function
    isMounted.current = true;
    fetchDistributorUsers();
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Your Users</h1>
        <div className="flex gap-2">
          <button 
            onClick={fetchDistributorUsers}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
          {/* <Link
            to="/distributor-create-user"
            className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <FaUserPlus /> Create User
          </Link> */}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <p>You haven't created any users yet.</p>
          <Link 
            to="/create-user" 
            className="inline-block mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Create Your First User
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dealer ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.username}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.city}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.dealerId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.balance}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openTransferModal(user)}
                        className="text-yellow-600 hover:text-yellow-800"
                        title="Transfer balance"
                      >
                        💸
                      </button>
                      <button
                        onClick={() => toggleStatus(user._id)}
                        className={`${
                          user.isActive ? "text-green-600" : "text-red-600"
                        } hover:opacity-70`}
                        title={user.isActive ? "Deactivate" : "Activate"}
                      >
                        {user.isActive ? <FaToggleOn size={18} /> : <FaToggleOff size={18} />}
                      </button>
                      {onEditUser ? (
                        <button
                          onClick={() => onEditUser(user._id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit user"
                        >
                          <FaEdit size={16} />
                        </button>
                      ) : (
                        <Link
                          to={`/edit-user/${user._id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit user"
                        >
                          <FaEdit size={16} />
                        </Link>
                      )}
                      <button
                        onClick={() => deleteUser(user._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete user"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Modal */}
      {transferOpen && transferUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-50" onClick={closeTransferModal}></div>
          <div className="bg-white dark:bg-gray-800 rounded shadow-lg z-50 w-full max-w-md p-6 text-black">
            <h2 className="text-lg font-semibold mb-2">Transfer Balance to {transferUser.username}</h2>
            <p className="text-sm text-gray-600 mb-4">Current balance: <strong>{transferUser.balance}</strong></p>
            <div className="mb-4">
              <label className="block text-sm mb-1">Amount</label>
              <input type="number" min="0" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeTransferModal} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={handleTransferSubmit} disabled={transferLoading} className="px-4 py-2 bg-blue-600 text-white rounded">
                {transferLoading ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributerUsers;
