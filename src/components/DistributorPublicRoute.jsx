import React from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux';

export default function DistributorPublicRoute({children}) {
  const { user, authChecked } = useSelector((s) => s.user);
  if (!authChecked) return null;
  if (user?.role === 'distributor') return <Navigate to="/distributor" />;
  return children;
}
