import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './pages/Homepage';
import Login from './pages/Login';
import Register from './pages/Register';

import Dashboard from './pages/admin/Dashboard';
import AdminLayout from './pages/admin/AdminLayout';
import ManageUsers from './pages/admin/ManageUsers';
import CreateUser from './pages/admin/CreateUser';
import EditUser from './pages/admin/EditUser';

import { useSelector } from 'react-redux';
import Spinner from './components/Spinner';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import AdminLogin from './pages/admin/AdminLogin';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminPublicRoute from './components/AdminPublicRoute';
import { Toaster } from 'react-hot-toast';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import WinningNumbers from './pages/admin/WinningNumbers';
import DrawList from './pages/admin/DrawList';

// this is the routing setup 
function App() {
  const { loading } = useSelector(state => state.alertSlice)
  return (

    <BrowserRouter>
    <Toaster position="top-right" />
      {loading ? (<Spinner />) : (<Routes>
        {/* homepage will be protected route  */}
        <Route path="/" element={
          <ProtectedRoute>
            <Homepage />
          </ProtectedRoute>

        }
        />


        {/* public routes */}
        <Route path='login' element={
          <PublicRoute>
            <Login />
          </PublicRoute>

        }></Route>

        <Route path='register' element={

          <PublicRoute>
            <Register />
          </PublicRoute>

        }></Route>

        {/* Distributor routes (support both /manage-users and /distributor/manage-users) */}
        <Route path="/manage-users" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />
        <Route path="/manage-users/:id" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />
        <Route path="/create-user" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />
        <Route path="/edit-user/:id" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />

        {/* Mirror distributor-prefixed URLs so old links continue to work */}
        <Route path="/distributor" element={
          <RoleProtectedRoute allowedRoles={['distributor']}>
            <Homepage />
          </RoleProtectedRoute>
        } />
        <Route path="/distributor/manage-users" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />
        <Route path="/distributor/manage-users/:id" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />
        <Route path="/distributor/create-user" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />
        <Route path="/distributor/edit-user/:id" element={
            <RoleProtectedRoute allowedRoles={['distributor']}>
              <Homepage />
            </RoleProtectedRoute>
        } />

        <Route path="/admin-login" element={
          <AdminPublicRoute>
            <AdminLogin />
          </AdminPublicRoute>
        } />

        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />  {/* Default to Dashboard */}
          <Route path="manage-users" element={<ManageUsers />} />
          <Route path="create-user" element={<CreateUser />} />
          <Route path="edit-user/:id" element={<EditUser />} />
          <Route path="winning-numbers" element={<WinningNumbers/>} />
          <Route path="draws" element={<DrawList/>} />
          <Route path="timeslots" element={<DrawList/>} />
        </Route>
      </Routes>


      )}
    </BrowserRouter>

  );
}

export default App;
