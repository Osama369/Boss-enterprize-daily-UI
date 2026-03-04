import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function RoleProtectedRoute({ children, allowedRoles }) {
  const { user, authChecked } = useSelector((state) => state.user);
  if (!authChecked) return null;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles.includes(user.role)) return children;
  return <Navigate to="/" />;
}
