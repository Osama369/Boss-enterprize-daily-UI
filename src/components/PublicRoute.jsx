import React from 'react'
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux';
const PublicRoute = ({children}) => {
    const { user, authChecked } = useSelector((state) => state.user);
    if (!authChecked) return null;
    if (user && user.role !== 'admin') return <Navigate to={"/"}/>;
    return children;
}

export default PublicRoute
