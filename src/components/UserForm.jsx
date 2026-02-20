import React, { useState } from "react";
import { useSelector } from 'react-redux';
import { toast } from "react-hot-toast";
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import CalculateIcon from '@mui/icons-material/Calculate';
import AccountCircle from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import BadgeIcon from '@mui/icons-material/Badge';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

const UserForm = ({ onSubmit, initialData = {}, isEditing = false, theme }) => {
  const [formData, setFormData] = useState({
    username: initialData.username || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    city: initialData.city || "",
    dealerId: initialData.dealerId || "",
    balance: initialData.balance || 0,
    isActive: initialData.isActive !== undefined ? initialData.isActive : true,
    singleFigure: initialData.singleFigure || 0,
    doubleFigure: initialData.doubleFigure || 0,
    tripleFigure: initialData.tripleFigure || 0,
    fourFigure: initialData.fourFigure || 0,
    hinsaMultiplier: initialData.hinsaMultiplier || 0,
    akraMultiplier: initialData.akraMultiplier || 0,
    tandolaMultiplier: initialData.tandolaMultiplier || 0,
    pangoraMultiplier: initialData.pangoraMultiplier || 0,
    commission: initialData.commission || 0,
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // determine current role from redux auth state
  const reduxUser = useSelector((s) => s.user?.user);
  const currentRole = reduxUser?.role || 'user';
  const isDistributorEditing = isEditing && currentRole === 'distributor';
  

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate passwords match if password field is filled
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    // Client-side validation: dealerId format (if provided) must be 4-10 alphanumeric chars
    if (formData.dealerId && !/^[A-Za-z0-9]{4,10}$/.test(formData.dealerId)) {
      toast.error('Dealer ID must be 4-10 alphanumeric characters');
      return;
    }

    // Password length validation: when creating (not editing) password is required and must be >=8
    if (!isEditing) {
      if (!formData.password || formData.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
    } else {
      if (formData.password && formData.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
    }

    // Prepare data for submission
    const dataToSubmit = { ...formData };
    
    // Remove unnecessary fields
    delete dataToSubmit.confirmPassword;
    
    // Don't send password if it's empty (editing case and password not changed)
    if (!dataToSubmit.password) {
      delete dataToSubmit.password;
    }
    
    onSubmit(dataToSubmit);
  };

  // regenerateDealerId removed — dealerId must be entered manually

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom>{isEditing ? 'Edit Distributor Account' : 'Create New Distributor Account'}</Typography>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth required name="username" label="Username" value={formData.username} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><AccountCircle /></InputAdornment>) }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth required name="email" label="Email" type="email" value={formData.email} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><EmailIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth required name="phone" label="Phone" value={formData.phone} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><PhoneIcon /></InputAdornment>) }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth required name="city" label="City" value={formData.city} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><LocationCityIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth type="number" name="singleFigure" label="Single Figure Commission" value={formData.singleFigure} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth type="number" name="doubleFigure" label="Double Figure Commission" value={formData.doubleFigure} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth type="number" name="tripleFigure" label="Triple Figure Commission" value={formData.tripleFigure} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth type="number" name="fourFigure" label="Four Figure Commission" value={formData.fourFigure} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth required type="number" name="hinsaMultiplier" label="Figure Prize" value={formData.hinsaMultiplier} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth required type="number" name="akraMultiplier" label="ARKRA Prize" value={formData.akraMultiplier} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth required type="number" name="tandolaMultiplier" label="Tandola Prize" value={formData.tandolaMultiplier} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth required type="number" name="pangoraMultiplier" label="Pangora Prize" value={formData.pangoraMultiplier} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><CalculateIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth type="number" name="commission" label="Hissa (Commission)" value={formData.commission} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><AttachMoneyIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth required name="dealerId" label="Dealer ID" value={formData.dealerId} onChange={handleChange} InputProps={{ startAdornment: (<InputAdornment position="start"><BadgeIcon /></InputAdornment>) }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            type="number"
            name="balance"
            label="Balance"
            value={formData.balance}
            onChange={handleChange}
            disabled={isDistributorEditing}
            helperText={isDistributorEditing ? 'Distributors cannot edit balance here — use Transfer' : ''}
            InputProps={{ startAdornment: (<InputAdornment position="start"><AttachMoneyIcon /></InputAdornment>) }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleChange}
            required={!isEditing}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            placeholder={isEditing ? 'Leave blank to keep current password' : 'Enter password'}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            name="confirmPassword"
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={handleChange}
            required={!isEditing || formData.password !== ''}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            placeholder={isEditing ? 'Leave blank to keep current password' : 'Confirm password'}
          />
        </Grid>

        {isEditing && (
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography>Status:</Typography>
              <Switch name="isActive" checked={formData.isActive} onChange={(e) => handleChange({ target: { name: 'isActive', type: 'checkbox', checked: e.target.checked } })} />
              <Typography>{formData.isActive ? 'Active' : 'Inactive'}</Typography>
            </Box>
          </Grid>
        )}

      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => window.history.back()}>Cancel</Button>
        <Button variant="contained" type="submit">{isEditing ? 'Update User' : 'Create User'}</Button>
      </Box>
    </Box>
  );
};

export default UserForm;
