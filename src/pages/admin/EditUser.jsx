import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { showLoading, hideLoading } from "../../redux/features/alertSlice";
import toast from 'react-hot-toast';
import UserForm from "../../components/UserForm";
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setError("");
        const token = localStorage.getItem("adminToken");
        const response = await axios.get(`/api/v1/users/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUserData(response.data);
      } catch (err) {
        console.error("Error fetching user:", err);
        const msg = err.response?.data?.message || "Failed to load user data";
        setError(msg);
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleUpdateUser = async (updatedData) => {
    try {
      setError("");
      dispatch(showLoading());
      const token = localStorage.getItem("adminToken");
      await axios.patch(`/api/v1/users/${id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      dispatch(hideLoading());
      toast.success("User updated successfully!");
      navigate("/admin/manage-users");
    } catch (err) {
      dispatch(hideLoading());
      const msg = err.response?.data?.message || "Failed to update user";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">Edit User</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : userData ? (
        <UserForm initialData={userData} onSubmit={handleUpdateUser} isEditing={true} />
      ) : (
        <Alert severity="warning">User not found or you don't have permission to edit this user.</Alert>
      )}
    </Container>
  );
};

export default EditUser;