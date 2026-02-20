import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { showLoading, hideLoading } from '../../redux/features/alertSlice';
import toast from 'react-hot-toast';
import UserForm from '../../components/UserForm';

const DistributorCreateUser = ({theme}) => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  const handleCreateUser = async (userData) => {
    try {
      setError('');
    //   dispatch(showLoading());

      // If distributor supplied an initial balance, we must create the user
      // with zero balance and then perform an atomic transfer so the
      // distributor's balance is deducted. This prevents creating funds
      // out of thin air.
      const initialBalance = Number(userData.balance || 0) || 0;
      const createPayload = { ...userData, balance: 0 };

      // generate a single idempotency key for create+fund flow
      const generateIdempotencyKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
      const idempotencyKey = generateIdempotencyKey();

      // Create the user using the distributor-specific endpoint
      const response = await axios.post('/api/v1/users/distributor-create-user', createPayload, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      const createdUser = response.data?.user;

      // If an initial balance was requested, call transfer endpoint
      if (initialBalance > 0 && createdUser && createdUser._id) {
        try {
          await axios.post(`/api/v1/users/${createdUser._id}/balance/transfer`, { amount: initialBalance }, {
            headers: { 'Idempotency-Key': idempotencyKey }
          }); 
          toast.success('User created and funded successfully');
        } catch (err) {
          // If transfer fails, notify distributor but user was created with zero balance
          const msg = err.response?.data?.error || 'User created, but funding failed';
          toast.error(msg);
        }
      } else {
        toast.success('User created successfully!');
      }

      // preserve distributor prefix if present
      if (location.pathname.startsWith('/distributor')) {
        navigate('/distributor/manage-users');
      } else {
        navigate('/manage-users');
      }
    } catch (error) {
      dispatch(hideLoading());
      const errorMessage = error.response?.data?.error || 'Failed to create user';
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Client</h1>
        <p className="text-gray-600 mt-1">Add a new client to your account</p>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      <UserForm 
        onSubmit={handleCreateUser}
        isEditing={false}
        theme={theme} // Pass the theme prop for styling
      />
    </div>
  );
};

export default DistributorCreateUser;
