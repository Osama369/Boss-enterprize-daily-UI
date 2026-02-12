import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDispatch } from "react-redux";
import { showLoading, hideLoading } from "../../redux/features/alertSlice";
import toast from 'react-hot-toast';
import UserForm from "../../components/UserForm";
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

const CreateUser = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [error, setError] = useState("");

  const handleCreateUser = async (userData) => {
    try {
      setError("");
      dispatch(showLoading());
      
      const token = localStorage.getItem("adminToken");
      await axios.post(
        "/api/v1/users/create-user",
        userData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      dispatch(hideLoading());
      toast.success("User created successfully!");
      navigate("/admin/manage-users");
    } catch (error) {
      dispatch(hideLoading());
      const msg = error.response?.data?.error || "Failed to create user";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ bgcolor: 'background.default', p: 3, borderRadius: 1 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Create New Distributor Account
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <UserForm onSubmit={handleCreateUser} />
      </Box>
    </Container>
  );
};

export default CreateUser;