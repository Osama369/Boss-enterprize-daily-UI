import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const AdminPublicRoute = ({ children }) => {
    const { user, authChecked } = useSelector((state) => state.user);
    if (!authChecked) return null;
    if (user?.role === 'admin') return <Navigate to="/admin" />;
    return children;
};

export default AdminPublicRoute;
