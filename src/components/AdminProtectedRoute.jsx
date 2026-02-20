import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const AdminProtectedRoute = ({ children }) => {
  const { user, authChecked } = useSelector((state) => state.user);
  if (!authChecked) return null;
  if (user?.role === 'admin') return children;
  return <Navigate to="/admin-login" />;
};

export default AdminProtectedRoute;
