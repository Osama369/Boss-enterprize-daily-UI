import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from 'react-redux';

export default function DistributorProtectedRoute({ children }) {
  const { user, authChecked } = useSelector((s) => s.user);
  if (!authChecked) return null;
  if (user?.role === 'distributor') return children;
  return <Navigate to="/distributor-login" />;
}
