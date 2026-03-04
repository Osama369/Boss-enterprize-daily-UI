import React from 'react'
import {Navigate} from 'react-router-dom'
import { useSelector } from 'react-redux';
const ProtectedRoute = ({children}) => {
    const { user, authChecked } = useSelector((state) => state.user);
    if (!authChecked) return null;
    if (user) return children;
    return <Navigate to={'/login'}/>
}

export default ProtectedRoute
