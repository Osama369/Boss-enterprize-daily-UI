import React, { useState } from "react";
import { Link } from "react-router-dom";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';

const UserTable = ({ users, toggleStatus, deleteUser, showOnlyDistributors = true, onTransfer = null }) => {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const findChildren = (parentId) => {
    if (!users || users.length === 0) return [];
    return users.filter(u => u.createdBy && String(u.createdBy) === String(parentId));
  };

  const displayedUsers = showOnlyDistributors ? (users || []).filter(u => u.role === 'distributor') : (users || []);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Username</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell>City</TableCell>
            <TableCell>Dealer ID</TableCell>
            <TableCell>Balance</TableCell>
            {showOnlyDistributors && <TableCell>Clients</TableCell>}
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayedUsers.map(user => {
            const children = findChildren(user._id).filter(c => c.role === 'user');
            return (
              <React.Fragment key={user._id}>
                <TableRow hover>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.city}</TableCell>
                  <TableCell>{user.dealerId}</TableCell>
                  <TableCell>{user.balance}</TableCell>
                  {showOnlyDistributors && <TableCell>{children.length}</TableCell>}
                  <TableCell>{user.role || 'user'}</TableCell>
                  <TableCell>
                    <Chip label={user.isActive ? 'Active' : 'Inactive'} color={user.isActive ? 'success' : 'error'} size="small" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {children.length > 0 && (
                        <IconButton size="small" onClick={() => toggleExpand(user._id)} title="View clients created by this distributor">
                          {expanded[user._id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => toggleStatus(user._id)} title={user.isActive ? 'Deactivate' : 'Activate'}>
                        {user.isActive ? <ToggleOnIcon color="success" /> : <ToggleOffIcon color="error" />}
                      </IconButton>
                      {user.role === 'distributor' && typeof onTransfer === 'function' && (
                        <IconButton size="small" onClick={() => onTransfer(user)} title="Transfer balance">
                          <CurrencyExchangeIcon color="warning" />
                        </IconButton>
                      )}
                      <IconButton size="small" component={Link} to={`/admin/edit-user/${user._id}`} title="Edit user">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteUser(user._id)} title="Delete user">
                        <DeleteIcon color="error" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>

                {children.length > 0 && (
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={showOnlyDistributors ? 10 : 9}>
                      <Collapse in={!!expanded[user._id]} timeout="auto" unmountOnExit>
                        <Box margin={1}>
                          <Typography variant="subtitle2">Clients</Typography>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Username</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Dealer ID</TableCell>
                                <TableCell>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {children.map(child => (
                                <TableRow key={child._id}>
                                  <TableCell>{child.username}</TableCell>
                                  <TableCell>{child.email}</TableCell>
                                  <TableCell>{child.phone}</TableCell>
                                  <TableCell>{child.dealerId}</TableCell>
                                  <TableCell>
                                    <Chip label={child.isActive ? 'Active' : 'Inactive'} color={child.isActive ? 'success' : 'error'} size="small" />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default UserTable;
