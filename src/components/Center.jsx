import React from 'react'
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import jsPDF from "jspdf";
import toast from 'react-hot-toast';
import { FixedSizeList as List } from 'react-window';
import { FaBalanceScale, FaBell, FaStar } from 'react-icons/fa';
import { Box, TextField, Button, Switch, FormControlLabel, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector, useDispatch } from "react-redux";
import { showLoading, hideLoading } from '../redux/features/alertSlice';
import { setUser } from '../redux/features/userSlice';
import  Spinner  from '../components/Spinner'
/* Body Content removed — du spplicated table was present above in the centered two-column layout. */

function Center() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userData = useSelector((state) => state.user);
  const role = userData?.user?.role;

  // Winning numbers will be populated from admin settings via API;
  // start empty so we can hide the notification panel until set.
  const [winningNumbers, setWinningNumbers] = useState([]);
  const [prizeType, setPrizeType] = useState("Hinsa");
  const [combineSelected, setCombineSelected] = useState(false);
  const [selectedPrizeEntry, setSelectedPrizeEntry] = useState("Akra"); 

  // Draw/timeSlot state
  const [draws, setDraws] = useState([]);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [drawRemainingMs, setDrawRemainingMs] = useState(null);
  const [drawDate, setDrawDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [drawTime, setDrawTime] = useState("");
      
  // Core entry states and refs
  const [entries, setEntries] = useState([]);
  const [voucherData, setVoucherData] = useState([]);
  const voucherDataRef = useRef([]);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const tableContainerRef = useRef(null);
  const prevEntriesCountRef = useRef(0);
  const [searchNumber, setSearchNumber] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null => search inactive
  const [searchLoading, setSearchLoading] = useState(false);

  // Helper: format a timeslot object to 12-hour label (e.g. 13 -> "1PM" or label "13:00" -> "1PM")
  const formatTimeSlotLabel = (slot) => {
    if (!slot) return "";
    // prefer explicit label if it's already human readable like '1PM' or '13:00'
    if (slot.title && typeof slot.title === 'string') {
      return slot.title;
    }
    const label = slot.label || (typeof slot.hour !== 'undefined' ? `${String(slot.hour).padStart(2, '0')}:00` : null);
    let hourNum = null;
    if (label && typeof label === 'string') {
      const m = label.match(/^(\d{1,2})/);
      if (m) hourNum = parseInt(m[1], 10);
    }
    if (hourNum === null && typeof slot.hour === 'number') hourNum = slot.hour;
    if (hourNum === null) return label || '';
    const suffix = hourNum < 12 ? 'AM' : 'PM';
    const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return `${hour12}${suffix}`;
  };

  // Loading and error states used across async operations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Input states and refs
  const [no, setNo] = useState("");
  const [f, setF] = useState("");
  const [s, setS] = useState("");
  const noInputRef = useRef(null);
  const fInputRef = useRef(null);
  const sInputRef = useRef(null);
  const [autoMode, setAutoMode] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const userId = userData?.user?._id;
        if (!userId) return;

        const response = await axios.get(`/api/v1/users/${userId}`, {
        });
        dispatch(setUser(response.data));
      } catch (error) {
        setError && setError("Failed to load user data");
        console.error(error);
      } finally {
        setLoading && setLoading(false);
      }
    })();
  }, [dispatch, navigate, userData?.user?._id]);

  const fetchTimeSlots = useCallback(async () => {
    try {
      // load all time slots (admin may mark some inactive/closed)
      const res = await axios.get('/api/v1/timeslots');
      const slots = res.data?.timeSlots || res.data || [];
      setDraws(Array.isArray(slots) ? slots : []);
      setSelectedDraw((prev) => {
        if (!prev || !prev._id) return prev;
        const refreshed = (Array.isArray(slots) ? slots : []).find((s) => String(s._id) === String(prev._id));
        return refreshed || null;
      });
    } catch (err) {
      console.error('Failed to fetch timeslots', err);
      setDraws([]);
    }
  }, []);

  // Fetch active timeSlots (admin-managed) so the select can show options
  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  // Live refresh timeslots when admin updates them.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onTimeSlotsUpdated = () => { fetchTimeSlots(); };
    const onStorage = (e) => {
      if (e.key === 'timeslots:lastUpdated') fetchTimeSlots();
    };
    const onFocus = () => { fetchTimeSlots(); };
    const intervalId = window.setInterval(() => {
      // Polling fallback for cross-machine updates.
      fetchTimeSlots();
    }, 20000);
    window.addEventListener('timeslots:updated', onTimeSlotsUpdated);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('timeslots:updated', onTimeSlotsUpdated);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchTimeSlots]);

  const syncBalance = useCallback(async (candidateBalance) => {
    if (candidateBalance !== undefined && candidateBalance !== null) {
      const parsed = Number(candidateBalance);
      const nextBalance = Number.isNaN(parsed) ? candidateBalance : parsed;
      dispatch(setUser({ ...(userData?.user || {}), balance: nextBalance }));
      return;
    }
    const userId = userData?.user?._id;
    if (!userId) return;
    try {
      const response = await axios.get(`/api/v1/users/${userId}`);
      dispatch(setUser(response.data));
    } catch (error) {
      console.warn("Failed to sync balance", error);
    }
  }, [dispatch, userData?.user]);


  const addEntry = async (customeEntries = null) => {
    const dataToAdd = customeEntries || entries;
    if (!dataToAdd || dataToAdd.length === 0) {
      toast("No record to save! ⚠️");
      return;
    }

    // Format payload for API
    const formattedData = dataToAdd.map(entry => ({
      uniqueId: entry.no,
      firstPrice: Number(entry.f) || 0,
      secondPrice: Number(entry.s) || 0,
    }));

    const payload = { data: formattedData };
    // require selected timeSlot and date
    if (selectedDraw && selectedDraw._id) {
      payload.timeSlotId = selectedDraw._id;
      payload.date = drawDate;
      // Prevent saving to closed/inactive time slots
      if (selectedDraw.isActive === false) {
        toast.error('Selected time slot is closed. Cannot save records.');
        return;
      }
    } else {
      toast.error("Please select a time slot before saving.");
      return;
    }

    // Snapshot for rollback
    const prev = voucherDataRef.current || entries || [];

    // Create temporary items to show immediately in UI (use _tempId to identify)
    const now = Date.now();
    const tempItems = formattedData.map((item, idx) => ({
      parentId: null,
      objectId: undefined,
      no: item.uniqueId,
      f: item.firstPrice,
      s: item.secondPrice,
      selected: false,
      _tempId: `temp_${now}_${idx}`,
    }));

    // Optimistically update UI (do not clear input fields here — keep existing input flow)
    setVoucherData(prevArr => [ ...prevArr , ...tempItems]);
    setEntries(prevArr => [ ...prevArr, ...tempItems]);
    toast.success("Record queued for save ✅");

    try {
      // Send to server (do not block UI on final refresh)
      const response = await axios.post("/api/v1/data/add-data", payload, {
        // timeout: 10000,
      });
      await syncBalance(response.data?.newBalance);

      // If server returns created data, reconcile quickly
      const created = response.data?.data || response.data?.created || null;
      if (Array.isArray(created) && created.length > 0) {
        // Flatten created entries into table rows if API returns parent docs
        const createdRows = created.flatMap((record) =>
          (record.data || []).map(item => ({
            parentId: record._id || null,
            objectId: item._id,
            no: item.uniqueId,
            f: item.firstPrice,
            s: item.secondPrice,
            selected: false,
          }))
        );

        // Replace temp items for matching uniqueIds, keep newest rows appended at bottom
        setVoucherData(prevArr => {
          const uniqueIds = new Set(createdRows.map(r => r.no));
          const remaining = prevArr.filter(p => !p._tempId || !uniqueIds.has(p.no));
          return [...remaining, ...createdRows];
        });
        setEntries(prev => {
          const uniqueIds = new Set(createdRows.map(r => r.no));
          const remaining = prev.filter(p => !p._tempId || !uniqueIds.has(p.no));
          return [...remaining, ...createdRows];
        });
      }

      // Run a background authoritative sync to reconcile any drift
      getAndSetVoucherData().catch(err => console.warn("Background sync failed:", err));
    } catch (error) {
      // Rollback optimistic UI on failure
      setVoucherData(prev);
      setEntries(prev);
      dispatch(hideLoading());
      console.error("Error adding entries:", error.response?.data?.error || error.message);
      toast.error(error.response?.data?.error || "Failed to add record ❌");
    }
  };


  

  const fetchVoucherData = async (selectedDate, timeSlotId, category = "general") => {
    try {
      if (!timeSlotId && !(selectedDraw && selectedDraw._id)) {
        toast.error("Please select a time slot to fetch records.");
        return [];
      }
      const params = { category, date: selectedDate || drawDate, timeSlotId: timeSlotId || selectedDraw._id };

      const response = await axios.get("/api/v1/data/get-data", {
        params,
      });

      console.log("getDatabydate", response);


      return response.data.data;
    } catch (error) {
      toast.error((error.response?.data?.error));
      return [];
    }
  };

  // Fetch winning numbers for the current draw date (timeSlot no longer used)
  const getWinningNumbers = async (date) => {

    try {
      const params = {};
      // Use selected date (drawDate) as authoritative date, fallback to passed date
      if (drawDate) params.date = drawDate;
      else params.date = date;

      const response = await axios.get("/api/v1/data/get-winning-numbers", {
        params,
      });
      if (response.data || response.data.winningNumbers) {
        const formattedNumbers = response.data.winningNumbers.map(item => ({
          number: item.number,
          type: item.type,
          color: item.type === 'first' ? [255, 0, 0] :
            item.type === 'second' ? [0, 0, 255] :
              [128, 0, 128] // Purple for third
        }));

        // Deduplicate by 6-digit number + type so that
        // entering the same winning number twice in admin
        // does not multiply the prize for one entry.
        const uniqueMap = new Map();
        formattedNumbers.forEach(w => {
          const key = `${w.number}-${w.type}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, w);
        });
        const uniqueWinningNumbers = Array.from(uniqueMap.values());

        setWinningNumbers(uniqueWinningNumbers);
        return uniqueWinningNumbers;
      } else {
        setWinningNumbers([]);
        return [];
      }
    } catch (error) {
      console.error("Error fetching winning numbers:", error);
      // toast.error("Failed to fetch winning numbers");
      setWinningNumbers([]);
      return [];
    }
  };

  

  const getAndSetVoucherData = async (drawArg = null) => {  // use to fetch data based on time/date or provided drawArg
    const timeSlotId = drawArg?._id || selectedDraw?._id;
    if (!timeSlotId) {
      // No draw selected — clear displayed entries and skip fetching.
      setVoucherData([]);
      setEntries([]);
      return;
    }

    const fetchedData = await fetchVoucherData(drawDate, timeSlotId);

    if (Array.isArray(fetchedData) && fetchedData.length > 0) {
      // Only use records that match the selected timeSlot (backend should already filter by timeSlotId)
      const filteredRecords = fetchedData.filter((record) => {
        const recordSlotId = record.timeSlotId?._id || record.timeSlotId || record._doc?.timeSlotId;
        return String(recordSlotId) === String(selectedDraw._id);
      });

      const combinedEntries = filteredRecords.flatMap((record) =>
        record.data.map((item, index) => ({
          parentId: record._id, // to keep track of the parent record
          objectId: item._id, // to keep track of the parent record
          // serial: index + 1, // creates a unique-enough ID without needing global index
          no: item.uniqueId,
          f: item.firstPrice,
          s: item.secondPrice,
          selected: false,
        }))
      );

      setVoucherData(combinedEntries);
      setEntries(combinedEntries);
      console.log("combined entires", combinedEntries);  // jo bhi entries hongi wo yengi

    } else {
      setVoucherData([]);
      setEntries([]);
    }
  };

  const searchNeedle = String(searchNumber || "").trim();
  const isSearchActive = searchNeedle.length > 0;
  const isDistributorSearchView = role === "distributor" && isSearchActive;
  const tableEntries = isSearchActive ? (searchResults || []) : entries;

  // Keep the latest appended entry visible.
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    const hasNewRows = entries.length > prevEntriesCountRef.current;
    prevEntriesCountRef.current = entries.length;
    if (!hasNewRows) return;
    if (isSearchActive) return;
    const rafId = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [entries.length, isSearchActive]);

  const groupedEntries = tableEntries.reduce((acc, entry) => {
    if (!acc[entry.parentId]) {
      acc[entry.parentId] = [];
    }
    acc[entry.parentId].push(entry);
    return acc;
  }, {});

  // Search NO in visible table context.
  // - user: local filter in own entries
  // - distributor: API search across all own clients for selected date/slot
  useEffect(() => {
    const q = String(searchNumber || "").trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    const timerId = window.setTimeout(async () => {
      setSelectedEntries([]);
      setSelectAll(false);
      if (role === "distributor") {
        if (!(selectedDraw && selectedDraw._id) || !drawDate) {
          setSearchResults([]);
          return;
        }
        setSearchLoading(true);
        try {
          const response = await axios.get("/api/v1/data/search-number", {
            params: {
              q,
              date: drawDate,
              timeSlotId: selectedDraw._id,
            },
          });
          const rows = Array.isArray(response.data?.data) ? response.data.data : [];
          setSearchResults(rows.map((row, idx) => ({
            ...row,
            id: row.objectId || `${row.parentId || "p"}_${row.no || "n"}_${idx}`,
            selected: false,
          })));
        } catch (error) {
          toast.error(error.response?.data?.error || "Failed to search number");
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      } else {
        const needle = String(q || '').trim();
        const localRows = (entries || []).filter((entry) =>
          String(entry.no || "").trim() === needle
        );
        setSearchResults(localRows);
      }
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [searchNumber, role, selectedDraw?._id, drawDate, entries]);

  // When selectedDraw or drawDate changes, fetch corresponding voucher data
  useEffect(() => {
    if (selectedDraw && selectedDraw._id) {
      // fetch for the newly selected timeSlot
      getAndSetVoucherData().catch(err => console.warn('Failed to load vouchers for selected draw', err));
    } else {
      // clear when no draw selected
      setVoucherData([]);
      setEntries([]);
    }
  }, [selectedDraw, drawDate]);

  // Delete confirmation modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogMode, setDeleteDialogMode] = useState(null); // 'single' | 'multiple'
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteConfirm = (parentId) => {
    setDeleteTargetId(parentId || null);
    setDeleteDialogMode('single');
    setDeleteDialogOpen(true);
  };

  const openDeleteSelectedConfirm = () => {
    if (!selectedEntries || selectedEntries.length === 0) {
      toast('No entries selected!');
      return;
    }
    setDeleteTargetId(null);
    setDeleteDialogMode('multiple');
    setDeleteDialogOpen(true);
  };

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      let deleteResponse;
      if (deleteDialogMode === 'single') {
        deleteResponse = await axios.delete(`/api/v1/data/delete-data/${deleteTargetId}`);
        toast.success('Record deleted successfully');
      } else if (deleteDialogMode === 'multiple') {
        deleteResponse = await axios.delete(`/api/v1/data/delete-individual-entries`, {
          data: { entryIds: selectedEntries }
        });
        toast.success('Selected records deleted successfully');
        setSelectedEntries([]);
        setSelectAll(false);
      }
      await syncBalance(deleteResponse?.data?.newBalance);

      // Refresh data
      await fetchVoucherData();
      await getAndSetVoucherData();
    } catch (error) {
      console.error('Error deleting records:', error);
      toast.error('Failed to delete records');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteDialogMode(null);
      setDeleteTargetId(null);
    }
  };

  // Selection and clipboard states/handlers
  const [selectAll, setSelectAll] = useState(false);
  const [copiedEntries, setCopiedEntries] = useState([]);

  const toggleSelectEntry = (id) => {
    setSelectedEntries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedEntries([]);
      setSelectAll(false);
    } else {
      const allIds = Object.values(groupedEntries).flat().map(entry => entry.objectId || entry.id);
      setSelectedEntries(allIds);
      setSelectAll(true);
    }
  };

  const handleCopySelected = () => {
    if (!selectedEntries || selectedEntries.length === 0) {
      toast("No entries selected to copy");
      return;
    }
    const selected = Object.values(groupedEntries).flat().filter(e => selectedEntries.includes(e.objectId || e.id))
      .map(e => ({ no: e.no, f: e.f, s: e.s }));
    setCopiedEntries(selected);
    toast.success(`${selected.length} entries copied`);
  };

  const handlePasteCopied = async () => {
    if (!copiedEntries || copiedEntries.length === 0) {
      toast("No copied entries to paste");
      return;
    }
    await addEntry(copiedEntries);
    toast.success("Pasted copied entries");
  };

  // SMS paste modal state and handlers
  const [smsInput, setSmsInput] = useState("");
  const [parsedEntries, setParsedEntries] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const closeSmsModal = () => {
    setShowModal(false);
    setParsedEntries([]);
    setSmsInput("");
  };

  const parseSMS = (rawText = "") => {
    const text = String(rawText || "").trim();
    if (!text) return [];

    const parsed = [];

    // 1) Compact SMS parser first:
    // Example: "93=07=...=85.f50s50" or "... s50f50"
    // Means list of numbers + one global F/S pair at end.
    const compact = text.replace(/\s+/g, " ").trim();
    let globalF = null;
    let globalS = null;
    let numbersPart = compact;

    const fsMatch = compact.match(/f\s*(\d+)\s*[^0-9a-zA-Z]*\s*s\s*(\d+)\s*$/i);
    const sfMatch = compact.match(/s\s*(\d+)\s*[^0-9a-zA-Z]*\s*f\s*(\d+)\s*$/i);

    if (fsMatch) {
      globalF = fsMatch[1];
      globalS = fsMatch[2];
      numbersPart = compact.slice(0, fsMatch.index).trim();
    } else if (sfMatch) {
      globalS = sfMatch[1];
      globalF = sfMatch[2];
      numbersPart = compact.slice(0, sfMatch.index).trim();
    }

    if (globalF !== null && globalS !== null) {
      const rawTokens = numbersPart.split(/[=.\s,;|:/\\-]+/).filter(Boolean);
      for (const token of rawTokens) {
        const noPart = token.replace(/[^+0-9]/g, "");
        if (!noPart) continue;
        if (!/^[+0-9]{1,16}$/.test(noPart)) continue;
        if (!/\d/.test(noPart)) continue;
        parsed.push({ no: noPart, f: String(globalF), s: String(globalS) });
      }
    }

    // 2) Standard triplet parser: NO F S (space/comma/colon/pipe separated)
    if (parsed.length === 0) {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const normalized = line
          .replace(/\b(no|number|num)\b\s*[:=]*/gi, " ")
          .replace(/\b(f|first)\b\s*[:=]*/gi, " ")
          .replace(/\b(s|second)\b\s*[:=]*/gi, " ")
          .replace(/[|,;:/\\=-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!normalized) continue;
        const parts = normalized.split(" ");
        if (parts.length < 3) continue;

        const noPart = String(parts[0] || "").trim();
        const fPart = String(parts[1] || "").trim();
        const sPart = String(parts[2] || "").trim();

        if (/^[+0-9]{1,16}$/.test(noPart) && /^\d{1,10}$/.test(fPart) && /^\d{1,10}$/.test(sPart)) {
          parsed.push({ no: noPart, f: fPart, s: sPart });
        }
      }
    }

    // 3) Final fallback: flat triplets blob "123 10 0 456 20 0"
    if (parsed.length === 0) {
      const blob = text
        .replace(/\b(no|number|num|f|first|s|second)\b\s*[:=]*/gi, " ")
        .replace(/[|,;:/\\=-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const tokens = blob ? blob.split(" ") : [];
      for (let i = 0; i + 2 < tokens.length; i += 3) {
        const noPart = String(tokens[i] || "").trim();
        const fPart = String(tokens[i + 1] || "").trim();
        const sPart = String(tokens[i + 2] || "").trim();
        if (/^[+0-9]{1,16}$/.test(noPart) && /^\d{1,10}$/.test(fPart) && /^\d{1,10}$/.test(sPart)) {
          parsed.push({ no: noPart, f: fPart, s: sPart });
        }
      }
    }

    // De-duplicate exact repeats to avoid accidental double inserts from SMS noise.
    const seen = new Set();
    return parsed.filter((item) => {
      const key = `${item.no}|${item.f}|${item.s}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleConfirmPaste = async () => {
    if (!parsedEntries || parsedEntries.length === 0) {
      toast("No parsed entries to paste");
      return;
    }
    await addEntry(parsedEntries);
    closeSmsModal();
    toast.success("SMS entries pasted");
  };

  // Input keyboard handlers and focus helpers
  const handleNoKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!no) {
        return;
      }
      if (autoMode) {
        handleSingleEntrySubmit(); // Auto Mode: Save immediately

      } else {
        fInputRef.current?.focus(); // OFF Mode: Go to F
      }
    }
  };

  const handleFKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!f) {
        return;
      }
      sInputRef.current?.focus(); // Go to S
    }
  };

  const handleSKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!s) {
        return; // don't submit when S is empty
      }
      if (autoMode) {
        handleSingleEntrySubmit(); // Auto Mode: Save immediately
      } else {
        handleSingleEntrySubmit(); // Save entry in OFF mode
        noInputRef.current?.focus(); // Move focus to NO
      }
    }
  };

  // Auto-detect simple '+N' single entries (allow +, ++, +++ prefixes)
  const handleFigureToSingle = () => {
    if (isPastClosingTime()) return false;
    if (!no || !f || !s) return false;
    const raw = String(no).trim();
    // match +N, ++N, +++N with one or more digits after pluses
    if (!/^\+{1,3}\d+$/.test(raw)) return false;

    const entry = {
      id: entries.length + 1,
      no: raw,
      f,
      s,
      selected: false,
    };
    addEntry([entry]);
    setNo('');
    noInputRef.current?.focus();
    return true;
  };

  // Auto-detect AKT single patterns (accept N++N, +NN+, +N+N) as single entries
  const handleAKTSingle = () => {
    if (isPastClosingTime()) return false;
    if (!no || !f || !s) return false;
    const raw = String(no).trim();
    const allowed = [/^\d\+\+\d$/, /^\+\d{2}\+$/, /^\+\d\+\d$/];
    if (!allowed.some((re) => re.test(raw))) return false;

    const entry = {
      id: entries.length + 1,
      no: raw,
      f,
      s,
      selected: false,
    };
    addEntry([entry]);
    setNo('');
    noInputRef.current?.focus();
    return true;
  };

  // Auto-detect ring-to-single patterns (+NNN, N+NN, NN+N) as single entries
  const handleRingToSingle = () => {
    if (isPastClosingTime()) return false;
    if (!no || !f || !s) return false;
    const raw = String(no).trim();
    const allowed = [/^\+\d{3}$/, /^\d\+\d{2}$/, /^\d{2}\+\d$/];
    if (!allowed.some((re) => re.test(raw))) return false;

    const entry = {
      id: entries.length + 1,
      no: raw,
      f,
      s,
      selected: false,
    };
    addEntry([entry]);
    setNo('');
    noInputRef.current?.focus();
    return true;
  };

  const handleFocus = () => {
    if (fInputRef.current) {
      fInputRef.current.select();
    }
  };

  const handleFocus2 = () => {
    if (sInputRef.current) {
      sInputRef.current.select();
    }
  };

  const toggleAutoMode = () => {
    setAutoMode(prev => !prev);
    if (!autoMode) {
      // when enabling auto mode, focus NO input for continuous entry
      setTimeout(() => noInputRef.current?.focus(), 50);
    }
  };

  if (loading) {  // this is loading that is running in seprately 
    return <p className="text-center text-lg"><Spinner /></p>;
  }

  if (error) {
    return <p className="text-center text-red-600">{error}</p>;
  }

  // Distributor summary values derived from current `entries`
  const distributorRecordCount = entries.length;
  const distributorFirstTotal = entries.reduce((sum, e) => sum + (Number(e.f) || 0), 0);
  const distributorSecondTotal = entries.reduce((sum, e) => sum + (Number(e.s) || 0), 0);
  const distributorGrandTotal = distributorFirstTotal + distributorSecondTotal;

  const parseRlcDbf = async (file) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);

    const recordCount = view.getUint32(4, true);
    const headerLength = view.getUint16(8, true);
    const recordLength = view.getUint16(10, true);

    const rows = [];
    const decoder = new TextDecoder('ascii');
    for (let i = 0; i < recordCount; i += 1) {
      const offset = headerLength + i * recordLength;
      if (offset + recordLength > bytes.length) break;
      const deletedFlag = bytes[offset];
      if (deletedFlag === 0x2A) continue; // skip deleted

      const start = offset + 1; // skip delete flag
      const ano = decoder.decode(bytes.slice(start, start + 4)).trim();
      const sumA1Str = decoder.decode(bytes.slice(start + 4, start + 9)).trim();
      const sumA2Str = decoder.decode(bytes.slice(start + 9, start + 14)).trim();

      if (!ano) continue;
      const sumA1 = Number.parseInt(sumA1Str || '0', 10) || 0;
      const sumA2 = Number.parseInt(sumA2Str || '0', 10) || 0;
      rows.push({ no: ano, f: sumA1, s: sumA2 });
    }
    return rows;
  };

  

  // Function to generate permutations
  const getPermutations = (str) => {
    let results = [];
    if (str.length === 1) return [str];

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const remainingChars = str.slice(0, i) + str.slice(i + 1);
      const remainingPermutations = getPermutations(remainingChars);

      for (const perm of remainingPermutations) {
        results.push(char + perm);
      }
    }
    return results;
  };


  // Function to get combinations of a certain length (for 4 figures Ring 24)
  const getCombinations = (str, length) => {
    if (length === 1) return str.split("");
    if (length === str.length) return [str];

    let combinations = [];
    for (let i = 0; i < str.length; i++) {
      let remaining = str.slice(0, i) + str.slice(i + 1);
      let subCombinations = getCombinations(remaining, length - 1);
      subCombinations.forEach(sub => combinations.push(str[i] + sub));
    }
    return combinations;
  };

  // Function to get all permutations of a string
  const getPermutation = (str) => {
    if (str.length === 1) return [str];

    return str.split("").flatMap((char, i) =>
      getPermutation(str.slice(0, i) + str.slice(i + 1)).map(perm => char + perm)
    );
  };



  // Function to generate ordered permutations for 4-digit inputs
  const generateOrderedPermutations = (num, length = 3) => {
    const str = num.toString();
    if (str.length !== 4) {
      console.log("Please enter a 4-digit number.");
      return [];
    }

    const combinations = getCombinations(str, length);
    const allPermutations = combinations.flatMap(getPermutation);
    return Array.from(new Set(allPermutations)).sort((a, b) => a[0].localeCompare(b[0]));
  };




  // genarte the 5 figure ring (60)
  const generate5DigitPermutations = (num, length = 3) => {
    let str = num.toString();
    if (str.length !== 5) {
      console.log("Please enter a 5-digit number.");
      return [];
    }

    let combinations = getCombinations(str, length);
    let allPermutations = combinations.flatMap(getPermutation);

    return Array.from(new Set(allPermutations)).sort((a, b) => a[0].localeCompare(b[0]));
  };

  // genarte the 5 digit ring (120)
  const generate6DigitPermutations = (num, length = 3) => {
    let str = num.toString();
    if (str.length !== 6) {
      console.log("Please enter a 6-digit number.");
      return [];
    }

    let combinations = getCombinations(str, length);
    let allPermutations = combinations.flatMap(getPermutation);

    return Array.from(new Set(allPermutations)).sort((a, b) => a[0].localeCompare(b[0]));
  };

  // genarte the 7 digit ring (210 for unique digits)
  const generate7DigitPermutations = (num, length = 3) => {
    const str = num.toString();
    if (str.length !== 7) {
      console.log("Please enter a 7-digit number.");
      return [];
    }

    const combinations = getCombinations(str, length);
    const allPermutations = combinations.flatMap(getPermutation);
    return Array.from(new Set(allPermutations)).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const generate8DigitPermutations = (num, length = 3) => {
    const str = num.toString();
    if (str.length !== 8) {
      console.log("Please enter an 8-digit number.");
      return [];
    }

    const combinations = getCombinations(str, length);
    const allPermutations = combinations.flatMap(getPermutation);
    return Array.from(new Set(allPermutations)).sort((a, b) => a[0].localeCompare(b[0]));
  };

  // 12 tandolla 

  const generate3FigureRingWithX = (str) => {
    if (str.length !== 3) {
      console.log("Input must be a 3-digit string");
      return [];
    }

    const result = [];

    // Step 1: Regular permutations of the 3-digit number
    const perms = Array.from(new Set(getPermutations(str))); // e.g., 001, 010, 100
    result.push(...perms);

    // Step 2: Insert 'x' at each position with padding
    for (let perm of perms) {
      result.push("+" + perm);                      // x001, x010, x100
      result.push(perm[0] + "+" + perm.slice(1));   // 0x01, 0x10, 1x00
      result.push(perm.slice(0, 2) + "+" + perm[2]); // 00x1, 01x0, 10x0
    }

    return Array.from(new Set(result)); // Remove any duplicates
  };


  // this is palti tandola 3 jaga

  const generate3FigureMinimalPermutations = (str) => {
    if (str.length !== 3) {
      console.log("Input must be a 3-digit string");
      return [];
    }

    // Generate permutations
    const perms = Array.from(new Set(getPermutations(str)));

    // For input like "001", this will produce:
    // ["001", "010", "100"] — unique minimal 3 variations

    return perms;
  };


  const generate4FigurePacket = (num) => {
    let str = num.toString();
    if (str.length !== 4) {
      console.log("Please enter exactly a 4-digit number.");
      return [];
    }

    const getPermutations = (str) => {
      if (str.length === 1) return [str];

      let results = [];
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const remaining = str.slice(0, i) + str.slice(i + 1);
        const permsOfRemaining = getPermutations(remaining);
        permsOfRemaining.forEach(perm => results.push(char + perm));
      }
      return results;
    };

    const allPermutations = getPermutations(str);

    // Remove duplicates and sort
    return Array.from(new Set(allPermutations)).sort();
  };


  const handleSingleEntrySubmit = () => {

    if (isPastClosingTime()) {
      toast("Draw is closed. Cannot add entries.");
      return;
    }
    if (!no || !f || !s) {
      toast("Please fill all fields.");
      return;
    }
     
    
    // auto delet handleRingToSingle
     if (handleRingToSingle()) {
       return; // Already handled
     }


    // auto detet handleAKRToSingle
    if (handleAKTSingle()) {
      return; // Already handled
    }

    // auto detect  figuretoSingle
    if (handleFigureToSingle()) {
      return; // Already handled
    }

    // Auto-detect AKR to Tandula pattern
    // if (handleAKRtoTandula()) {
    //   return; 
    // }


    // Auto-detect AKR to Packet pattern
    // if (handleAKRtoPacket()) {
    //   return; 
    // }

    // Auto delete tandula to packet
    // if (handleTandulaToPacket()) {
    //   return; 
    // }

    const entry = {
      id: entries.length + 1,
      no,
      f,
      s,
      selected: false,
    };

    addEntry([entry]);
    setNo('');
    // Focus NO for next entry
    noInputRef.current?.focus();
  };









  const handle4FigurePacket = () => {
    if (isPastClosingTime()) {
      toast("Draw is closed. Cannot add entries.");
      return;
    }
    if (!no || no.length < 4 || !f || !s) {
      alert("Please enter at least a 4-digit number and F/S values.");
      return;
    }

    if (no.length !== 4) {
      alert("Please enter exactly a 4-digit number.");
      return;
    }

    const result = generate4FigurePacket(no);
    console.log(result); // Will show 24 permutations

    const updatedEntries = result.map((perm, index) => ({
      id: entries.length + index + 1,
      no: perm,
      f: f,
      s: s,
      selected: false,
    }));

    addEntry(updatedEntries);
    setNo('');
    noInputRef.current?.focus();

    console.log(`✅ ${updatedEntries.length} entries added successfully!`);
  };







  const handlePaltiTandula = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (!no || no.length < 3 || no.length > 8 || !f || !s) {
      alert("Please enter a 3 to 8 digit number and F/S values.");
      return;
    }

    let result = [];

    if (no.length === 3) {
      result = Array.from(new Set(getPermutations(no))); // 6 permutations
    } else if (no.length === 4) {
      result = generateOrderedPermutations(no, 3); // 4-digit ring
    } else if (no.length === 5) {
      result = generate5DigitPermutations(no, 3); // 5-digit ring
    } else if (no.length === 6) {
      result = generate6DigitPermutations(no, 3); // 6-digit ring
    } else if (no.length === 7) {
      result = generate7DigitPermutations(no, 3); // 7-digit ring
    } else if (no.length === 8) {
      result = generate8DigitPermutations(no, 3); // 8-digit ring
    }

    const updatedEntries = result.map((perm, index) => ({
      id: entries.length + index + 1,
      no: perm,
      f: f,
      s: s,
      selected: false,
    }));

    addEntry(updatedEntries); // Or setEntries(...), depending on your app state
    setNo('');
    noInputRef.current?.focus();
  };



  // 12 tandulla ring  3 figure ring
  const handle3FigureRingWithX = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (no && f && s) {
      if (no.length !== 3) {
        toast.error("Enter exactly a 3-digit number.");
        return;
      }

      const distinct = new Set(no.split("")).size;
      if (distinct !== 2) {
        toast.error("Use a 3-digit number with exactly two matching digits (e.g., 112 or 223).");
        return;
      }

      // Generate permutations with 'x' substitutions
      const generatedRingPermutations = generate3FigureRingWithX(no);

      // Create new entry objects
      const updatedEntries = generatedRingPermutations.map((perm, index) => ({
        id: entries.length + index + 1,
        no: perm,
        f: f,
        s: s,
        selected: false
      }));

      console.log("3-Figure Ring Entries:", updatedEntries);

      // Add entries using your existing handler
      addEntry(updatedEntries);
      setNo('');
      noInputRef.current?.focus();
    }
  };

  const handleChakriRing = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (no.length !== 3 || !f || !s) {
      toast.error("Please enter exactly a 3-digit number and F/S values.");
      return;
    }
    if (no && f && s) {
      const generatedPermutations = getPermutations(no);
      const startId = entries.length + 1;
      let idCounter = 0;

      const updatedEntries = generatedPermutations.flatMap((perm) => {
        const variants = [
          perm, // Chakri Ring
          `+${perm}`, // Back Ring
          `${perm.slice(0, 1)}+${perm.slice(1)}`, // Cross Ring
          `${perm.slice(0, 2)}+${perm.slice(2)}` // Double Cross
        ];

        return variants.map((variant) => ({
          id: startId + idCounter++,
          no: variant,
          f,
          s,
          selected: false
        }));
      });

      addEntry(updatedEntries);
      setNo('');
      noInputRef.current?.focus();
    }
  };

  // function to AKR 2 figure 

  const handleAKR2Figure = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (no.length !== 2 || !f || !s) {
      console.log("Please enter a 2-digit number and prices.");
      return;
    }

    const num = no.toString();
    const generatedPatterns = [
      num,       // "23"
      `+${num}+`,   // "+23+"
      `++${num}`, // "++23"
      `${num[0]}+${num[1]}`, // "2+3"
      `+${num[0]}+${num[1]}`, // "+2+3"
      `${num[0]}++${num[1]}`  // "2++3"
    ];

    const updatedEntries = generatedPatterns.map((pattern, index) => ({
      id: entries.length + index + 1,
      no: pattern,
      f: f,
      s: s,
      selected: false
    }));

    // setEntries((prevEntries) => [...prevEntries, ...updatedEntries]);  // Append new entries
    addEntry(updatedEntries)
    setNo('');
    noInputRef.current?.focus();
  };


  // hanble AKR 2 figure 3 jaga
  const handleAKR2Figure3Jaga = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (no.length !== 2 || !f || !s) {
      console.log("Please enter a 2-digit number and prices.");
      return;
    }

    const num = no.toString();
    const generatedPatterns = [
      num,       // "23"
      `+${num}+`,   // "+23+"
      `++${num}`, // "++23"
      // `${num[0]}+${num[1]}`, // "2+3"
      // `+${num[0]}+${num[1]}`, // "+2+3"
      // `${num[0]}++${num[1]}`  // "2++3"
    ];

    const updatedEntries = generatedPatterns.map((pattern, index) => ({
      id: entries.length + index + 1,
      no: pattern,
      f: f,
      s: s,
      selected: false
    }));

    // setEntries((prevEntries) => [...prevEntries, ...updatedEntries]);  // Append new entries
    addEntry(updatedEntries)
    setNo('');
    noInputRef.current?.focus();
  };




  const handlePaltiAKR = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (!f || !s) {
      alert("Please enter valid F/S values.");
      return;
    }

    if (no.length >= 3 && no.length <= 8) {
      const combinations = getCombinations(no, 2); // Get all 2-digit combinations
      const pairs = combinations.flatMap(getPermutation); // Get ordered pairs
      const uniquePairs = [...new Set(pairs)]; // Remove duplicates

      const formatted = uniquePairs.map((pair, index) => ({
        id: entries.length + index + 1,
        no: pair,
        f: f,
        s: s,
        selected: false,
      }));

      addEntry(formatted);
      setNo('');
      noInputRef.current?.focus();
    } else {
      alert("Please enter a valid 3 to 8-digit number.");
    }
  };



  const handleRingPlusAKR = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return;
    }
    if (no.length === 3 && f && s) {
      const threeDigit = {
        id: entries.length + 1,
        no: no,
        f: f,
        s: s,
        selected: false,
      };

      const twoDigit = {
        id: entries.length + 2,
        no: no.slice(0, 2),
        f: f,
        s: s,
        selected: false,
      };

      addEntry([threeDigit, twoDigit]);
      setNo('');
      noInputRef.current?.focus();
    } else {
      toast.error("Please enter exactly 3 digits and valid F/S values");
    }
  };



  const handleAKRtoTandula = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return false;
    }

    // Normalize input: remove spaces
    const rawNo = String(no || '').replace(/\s+/g, '');
    if (!rawNo) return false;

    // If user typed '++' anywhere, reject immediately
    if (/\+\+/.test(rawNo)) {
      toast.error("Invalid pattern: use a single '+' for AKR to Tandula (e.g. +12, 1+2, 12+), not '++'.");
      return false;
    }

    // Allowed patterns for AKR -> Tandula (3 chars total)
    const allowed = [/^\+\d{2}$/, /^\d\+\d$/, /^\d{2}\+$/];
    if (rawNo.length !== 3 || !allowed.some((re) => re.test(rawNo))) {
      return false; // not a tandula pattern we handle here
    }

    // Require numeric F (we will divide by 10 for tandula price)
    const fNum = Number(String(f).replace(/,/g, ''));
    if (isNaN(fNum)) {
      toast.error('Invalid F price: must be a number');
      return false;
    }

    const plusIndex = rawNo.indexOf('+');
    const price = fNum / 10;
    const sNum = Number(String(s).replace(/,/g, ''));
    const priceS = !isNaN(sNum) ? sNum / 10 : s;
    const generated = [];

    for (let i = 0; i <= 9; i++) {
      const newNo = rawNo.slice(0, plusIndex) + i + rawNo.slice(plusIndex + 1);
      generated.push({
        id: entries.length + generated.length + 1,
        no: newNo,
        f: price,
        s: priceS,
        selected: false,
      });
    }

    addEntry(generated);
    setNo("");
    noInputRef.current?.focus();
    return true;
  };


  // ...existing code...

  const handleAKRtoPacket = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return false;
    }
    // Reject invalid ++N (single digit) pattern — require ++NN
    // Allow only specific patterns. If NO contains any '+' ensure it matches one of the allowed forms.
    if (no && no.includes('+')) {
      // Explicitly ignore patterns like '++N' (double plus + single digit) so they are treated as normal single entries
      if (/^\+\+\d$/.test(no)) {
        return false;
      }
      const allowed = [/^\+\+\d{2}$/, /^\d\+\+\d$/, /^\+\d{2}\+$/, /^\+\d\+\d$/];
      const ok = allowed.some((re) => re.test(no));
      if (!ok) {
        toast.error("Invalid pattern: allowed patterns are ++NN, N++N, +NN+, +N+N");
        return false;
      }
    }
    // Support both ++NN and N++N patterns
    if (
      no.length === 4 &&
      !isNaN(Number(f)) &&
      !isNaN(Number(s))
    ) {
      const priceF = Number(f) / 100;
      const priceS = Number(s) / 100;
      const generated = [];
      if (no.startsWith('++') && /^\d{2}$/.test(no.slice(2))) {
        // ++NN pattern
        const base = no.slice(2);
        for (let i = 0; i <= 99; i++) {
          const prefix = i.toString().padStart(2, '0');
          const newNo = `${prefix}${base}`;
          generated.push({
            id: entries.length + generated.length + 1,
            no: newNo,
            f: priceF,
            s: priceS,
            selected: false,
          });
        }
        addEntry(generated);
        setNo("");
        // setF("");
        // setS("");
        noInputRef.current?.focus();
        return true;
      } else if (/^\d\+\+\d$/.test(no)) {
        // N++N pattern
        const first = no[0];
        const last = no[3];
        for (let i = 0; i <= 99; i++) {
          const infix = i.toString().padStart(2, '0');
          const newNo = `${first}${infix}${last}`;
          generated.push({
            id: entries.length + generated.length + 1,
            no: newNo,
            f: priceF,
            s: priceS,
            selected: false,
          });
        }
        addEntry(generated);
        setNo("");
        // setF("");
        // setS("");
        noInputRef.current?.focus();
        return true;
      } else if (/^\+\d{2}\+$/.test(no)) {
        // +NN+ pattern (e.g., +10+)
        const mid = no.slice(1, 3); // e.g., "10"
        for (let i = 0; i <= 99; i++) {
          const infix = i.toString().padStart(2, '0');
          const newNo = `${infix[0]}${mid}${infix[1]}`;
          generated.push({
            id: entries.length + generated.length + 1,
            no: newNo,
            f: priceF,
            s: priceS,
            selected: false,
          });
        }
        addEntry(generated);
        setNo("");
        // setF("");
        // setS("");
        noInputRef.current?.focus();
        return true;
      }

      else if (/^\+\d\+\d$/.test(no)) {
        // +N+N pattern (e.g., +1+0)
        const first = no[1];
        const last = no[3];
        for (let i = 0; i <= 99; i++) {
          const infix = i.toString().padStart(2, '0');
          const newNo = `${infix[0]}${first}${infix[1]}${last}`;
          generated.push({
            id: entries.length + generated.length + 1,
            no: newNo,
            f: priceF,
            s: priceS,
            selected: false,
          });
        }
        addEntry(generated);
        setNo(""); noInputRef.current?.focus();
        return true;
      }


    }
    return false;
  };


  // handleTandulaToPacket

  const handleTandulaToPacket = () => {
    if (isPastClosingTime()) {
      toast.error("Draw is closed. Cannot add entries.");
      return false;
    }

    if (!no || !f || !s) return false;
    const priceF = !isNaN(Number(f)) ? Number(f) / 10 : f;
    const priceS = !isNaN(Number(s)) ? Number(s) / 10 : s;
    const generated = [];
    // +NNN pattern
    if (/^\+\d{3}$/.test(no)) {
      const base = no.slice(1); // e.g., "123"
      for (let i = 0; i <= 9; i++) {
        const newNo = `${i}${base}`;
        generated.push({
          id: entries.length + generated.length + 1,
          no: newNo,
          f: priceF,
          s: priceS,
          selected: false,
        });
      }
      addEntry(generated);
      setNo(""); noInputRef.current?.focus();
      return true;
    }
    // N+NN pattern
    if (/^\d\+\d{2}$/.test(no)) {
      const first = no[0];
      const base = no.slice(2); // e.g., "23"
      for (let i = 0; i <= 9; i++) {
        const newNo = `${first}${i}${base}`;
        generated.push({
          id: entries.length + generated.length + 1,
          no: newNo,
          f: priceF,
          s: priceS,
          selected: false,
        });
      }
      addEntry(generated);
      setNo(""); noInputRef.current?.focus();
      return true;
    }
    // NN+N pattern
    if (/^\d{2}\+\d$/.test(no)) {
      const first = no.slice(0, 2);
      const last = no[3];
      for (let i = 0; i <= 9; i++) {
        const newNo = `${first}${i}${last}`;
        generated.push({
          id: entries.length + generated.length + 1,
          no: newNo,
          f: priceF,
          s: priceS,
          selected: false,
        });
      }
      addEntry(generated);
      setNo(""); noInputRef.current?.focus();
      return true;
    }
    return false;
  };


  const handlePacket = () => {
    // 
  }

  

  const filterEntriesByPrizeType = (entries, PrizeEntry) => {
    if (PrizeEntry === "All") return entries;
    return entries.filter(entry => {
      const number = entry.no || entry.number;
      if (PrizeEntry === "Hinsa") {
        return (
          /^\d{1}$/.test(number) ||
          (number.includes('+') && number.length === 2) ||
          (number.split('+').length - 1 === 2 && number.length === 3) ||
          (number.split('+').length - 1 === 3 && number.length === 4)
        );
      }
      if (PrizeEntry === "Akra") {
        return (
          /^\d{2}$/.test(number) ||
          (number.includes('+') && number.length === 3) ||
          (number.split('+').length - 1 === 2 && number.length === 4)
        );
      }
      if (PrizeEntry === "Tandola") {
        return (
          /^\d{3}$/.test(number) ||
          (number.length === 4 && number.includes('+'))
        );
      }
      if (PrizeEntry === "Pangora") {
        return /^\d{4}$/.test(number);
      }
      return false;
    });
  };

  

  // Add this function in your Center component
  const fetchCombinedVoucherData = async (selectedDate, selectedTimeSlot) => {
    try {
      if (!(selectedDraw && selectedDraw._id)) {
        toast.error("Please select a time slot to fetch combined records.");
        return [];
      }
      const params = { date: selectedDate, timeSlotId: selectedDraw._id };

      const response = await axios.get("/api/v1/data/get-data", {
        params,
      });

      const records = response.data.data || [];
      const combined = records.flatMap(record => (record.data || []).map(item => ({ ...item, parentDoc: record })));
      return combined;
    } catch (error) {
      console.error("Error fetching combined voucher data:", error);
      toast.error("Failed to fetch combined voucher data");
      return [];
    }
  };

  // Add this function in your Center component
  const generateCombinedVoucherPDF = async (category = "general") => {
    const fetchedEntries = await fetchCombinedVoucherData(drawDate, drawTime, category);
    if (fetchedEntries.length === 0) {
      toast("No combined records found..");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // One-line save/preview helper: saves PDF with category and date in filename
    const savePdf = (docObj, cat) => {
      const drawFileLabel = selectedDraw ? `${(selectedDraw.title || 'draw').replace(/\s+/g, '_')}_${new Date(selectedDraw.draw_date).toISOString().split('T')[0]}` : new Date(drawDate).toISOString().split('T')[0];
      return docObj.save(`Combined_Voucher_${cat}_${drawFileLabel}.pdf`);
    };

    // Process and combine all entries (backend returns draw-specific data)
    const allVoucherRows = fetchedEntries.flatMap(entry =>
      entry.data.map(item => ({
        number: item.uniqueId,
        first: item.firstPrice,
        second: item.secondPrice,
        dealer: entry.userId.username,
        dealerId: entry.userId.dealerId
      }))
    );

    // Group duplicate entries and sum their prizes
    const combinedEntries = {};
    allVoucherRows.forEach(({ number, first, second, dealer, dealerId }) => {
      const key = number;
      if (combinedEntries[key]) {
        combinedEntries[key].first += first;
        combinedEntries[key].second += second;
        combinedEntries[key].dealers.add(`${dealer}(${dealerId})`);
        combinedEntries[key].count += 1;
      } else {
        combinedEntries[key] = {
          number,
          first,
          second,
          dealers: new Set([`${dealer}(${dealerId})`]),
          count: 1
        };
      }
    });

    // Convert to array and sort
    const processedEntries = Object.values(combinedEntries).map(entry => ({
      ...entry,
      dealers: Array.from(entry.dealers).join(', ')
    }));

    // Split entries into categories with ascending sorting
    const hinsa = [], akra = [], tandola = [], pangora = [];

    processedEntries.forEach(({ number, first, second, dealers, count }) => {
      if (/^\d{1}$/.test(number) ||
        (number.includes('+') && number.length === 2) ||
        (number.split('+').length - 1 === 2 && number.length === 3) ||
        (number.split('+').length - 1 === 3 && number.length === 4)
      ) {
        if (selectedPrizeEntry === "All" || selectedPrizeEntry === "Hinsa") {
          hinsa.push([number, first, second, dealers, count]);
        }
      } else if (
        /^\d{2}$/.test(number) ||
        (number.includes('+') && number.length <= 3) ||
        (number.split('+').length - 1 === 2 && number.length === 4)
      ) {
        if (selectedPrizeEntry === "All" || selectedPrizeEntry === "Akra") {
          akra.push([number, first, second, dealers, count]);
        }
      } else if (
        /^\d{3}$/.test(number) ||
        (number.length === 4 && number.includes('+'))
      ) {
        if (selectedPrizeEntry === "All" || selectedPrizeEntry === "Tandola") {
          tandola.push([number, first, second, dealers, count]);
        }
      } else if (/^\d{4}$/.test(number)) {
        if (selectedPrizeEntry === "All" || selectedPrizeEntry === "Pangora") {
          pangora.push([number, first, second, dealers, count]);
        }
      }
    });

    // Sort each section in ascending order
    const sortEntries = (entries) => {
      return entries.sort((a, b) => {
        const numA = a[0].replace(/\+/g, '');
        const numB = b[0].replace(/\+/g, '');
        return numA.localeCompare(numB, undefined, { numeric: true });
      });
    };

    sortEntries(hinsa);
    sortEntries(akra);
    sortEntries(tandola);
    sortEntries(pangora);

    const totalEntries = processedEntries.length;
    const totalRecords = processedEntries.reduce((sum, entry) => sum + entry.count, 0);

    // Calculate totals for each section
    const calculateSectionTotals = (rows) => {
      return rows.reduce(
        (acc, row) => {
          acc.firstTotal += row[1];
          acc.secondTotal += row[2];
          acc.recordCount += row[4];
          return acc;
        },
        { firstTotal: 0, secondTotal: 0, recordCount: 0 }
      );
    };

    const hinsaTotals = calculateSectionTotals(hinsa);
    const akraTotals = calculateSectionTotals(akra);
    const tandolaTotals = calculateSectionTotals(tandola);
    const pangoraTotals = calculateSectionTotals(pangora);

    const grandTotals = {
      firstTotal: hinsaTotals.firstTotal + akraTotals.firstTotal + tandolaTotals.firstTotal + pangoraTotals.firstTotal,
      secondTotal: hinsaTotals.secondTotal + akraTotals.secondTotal + tandolaTotals.secondTotal + pangoraTotals.secondTotal,
      recordCount: hinsaTotals.recordCount + akraTotals.recordCount + tandolaTotals.recordCount + pangoraTotals.recordCount
    };
    const grandTotal = grandTotals.firstTotal + grandTotals.secondTotal;

    const addHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Total Sale Report (" + category + ")", pageWidth / 2, 15, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Main Distributor: ${userData?.user.username} (${userData?.user.dealerId})`, 14, 30);
      doc.text(`City: ${userData?.user.city}`, 14, 40);
  const drawHeaderLabel = selectedDraw ? `${selectedDraw.title} (${new Date(selectedDraw.draw_date).toLocaleDateString()})` : drawDate;
  doc.text(`Draw: ${drawHeaderLabel}`, 14, 50);
      // doc.text(`Draw Time: ${drawTime}`, 14, 60);
      // doc.text(`Unique Entries: ${totalEntries}`, 14, 70);
      // doc.text(`Total Records: ${totalRecords}`, 14, 80);

      // Add grand totals
      doc.text(`First Total: ${grandTotals.firstTotal}`, 110, 50);
      doc.text(`Second Total: ${grandTotals.secondTotal}`, 110, 60);
      doc.text(`Grand Total: ${grandTotal}`, 110, 70);
      // doc.text(`Total Records: ${grandTotals.recordCount}`, 110, 80);
    };

    // Ledger-style renderSection: split into 3 vertical columns with headers and borders
    const renderSection = (title, rows, startY = 90) => {
      if (rows.length === 0) return startY;

      const rowHeight = 8;
      const colWidths = [20, 17, 17];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      let y = startY;

      // Section totals & header
      const totals = calculateSectionTotals(rows);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${title} (${rows.length} entries)`, 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`First Total: ${totals.firstTotal}`, 14, y);
      doc.text(`Second Total: ${totals.secondTotal}`, 60, y);
      doc.text(`Total: ${totals.firstTotal + totals.secondTotal}`, 106, y);
      y += 5;

      // Distribute rows row-wise across three columns (left, middle, right)
      // so entries render across the row: 0 -> left, 1 -> middle, 2 -> right,
      // 3 -> left (next row), etc.
      const leftRows = [];
      const middleRows = [];
      const rightRows = [];
      rows.forEach((r, idx) => {
        if (idx % 3 === 0) leftRows.push(r);
        else if (idx % 3 === 1) middleRows.push(r);
        else rightRows.push(r);
      });

      const leftX = 14;
      const middleX = leftX + tableWidth;
      const rightX = middleX + tableWidth;

      const drawTableHeader = (x, yy) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        // light gray header background + black border
        doc.setFillColor(230, 230, 230);
        doc.setDrawColor(0, 0, 0);
        // draw header boxes first (fill + stroke)
        doc.rect(x, yy, colWidths[0], rowHeight, 'FD');
        doc.rect(x + colWidths[0], yy, colWidths[1], rowHeight, 'FD');
        doc.rect(x + colWidths[0] + colWidths[1], yy, colWidths[2], rowHeight, 'FD');
        // then draw header labels on top
        doc.setTextColor(0, 0, 0);
        doc.text("Number", x + 1, yy + 5);
        doc.text("First", x + colWidths[0] + 1, yy + 5);
        doc.text("Second", x + colWidths[0] + colWidths[1] + 1, yy + 5);
        // reset fill to white for subsequent rows
        doc.setFillColor(255, 255, 255);
        return yy + rowHeight;
      };

      let headerY = drawTableHeader(leftX, y);
      if (middleRows.length > 0) drawTableHeader(middleX, y);
      if (rightRows.length > 0) drawTableHeader(rightX, y);

      let currentY = headerY;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      const maxRows = Math.max(leftRows.length, middleRows.length, rightRows.length);

      for (let i = 0; i < maxRows; i++) {
        if (currentY > pageHeight - 30) {
          doc.addPage();
          // don't print continued title per user request; just redraw headers
          currentY = 35;
          drawTableHeader(leftX, currentY);
          if (middleRows.length > 0) drawTableHeader(middleX, currentY);
          if (rightRows.length > 0) drawTableHeader(rightX, currentY);
          currentY += rowHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
        }

        // left
        if (i < leftRows.length) {
          const [num, f, s] = leftRows[i];
          const entryColor = getEntryColor(num);
          // highlight number cell with light gray background
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(0, 0, 0);
          doc.rect(leftX, currentY, colWidths[0], rowHeight, 'FD');
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), leftX + 1, currentY + 5);
          // reset fill back to white
          doc.setFillColor(255, 255, 255);
          doc.rect(leftX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), leftX + colWidths[0] + 1, currentY + 5);
          doc.rect(leftX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), leftX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        // middle
        if (i < middleRows.length) {
          const [num, f, s] = middleRows[i];
          const entryColor = getEntryColor(num);
          // highlight number cell with light gray background
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(0, 0, 0);
          doc.rect(middleX, currentY, colWidths[0], rowHeight, 'FD');
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), middleX + 1, currentY + 5);
          doc.setFillColor(255, 255, 255);
          doc.rect(middleX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), middleX + colWidths[0] + 1, currentY + 5);
          doc.rect(middleX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), middleX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        // right
        if (i < rightRows.length) {
          const [num, f, s] = rightRows[i];
          const entryColor = getEntryColor(num);
          // highlight number cell with light gray background
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(0, 0, 0);
          doc.rect(rightX, currentY, colWidths[0], rowHeight, 'FD');
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), rightX + 1, currentY + 5);
          doc.setFillColor(255, 255, 255);
          doc.rect(rightX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), rightX + colWidths[0] + 1, currentY + 5);
          doc.rect(rightX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), rightX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        currentY += rowHeight;
      }

      return currentY + 10;
    };

    addHeader();
    let nextY = 100;

    // Render each section if it has entries
    if (hinsa.length > 0) {
      nextY = renderSection("HINSA", hinsa, nextY);
    }
    if (akra.length > 0) {
      nextY = renderSection("AKRA", akra, nextY);
    }
    if (tandola.length > 0) {
      nextY = renderSection("TANDOLA", tandola, nextY);
    }
    if (pangora.length > 0) {
      nextY = renderSection("PANGORA", pangora, nextY);
    }

    // Save using helper that includes category and date
    savePdf(doc, category);
    toast.success("Combined Voucher PDF downloaded successfully!");
  };

  
  const generateVoucherPDF = async (category) => {
    const fetchedEntries = await fetchVoucherData(drawDate, drawTime, category);
    if (fetchedEntries.length === 0) {
      toast("No Record found..");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Get all voucher rows and categorize them (backend returns draw-specific data)
    const allVoucherRows = fetchedEntries.flatMap(entry => entry.data.map(item => ({
      number: item.uniqueId,
      first: item.firstPrice,
      second: item.secondPrice
    })));

    // Split entries into categories (same logic as in generateLedgerPDF)
    const hinsa = [], akra = [], tandola = [], pangora = [];

    allVoucherRows.forEach(({ number, first, second }) => {
      if (/^\d{1}$/.test(number) ||
        (number.includes('+') && number.length === 2) ||
        (number.split('+').length - 1 === 2 && number.length === 3) ||
        (number.split('+').length - 1 === 3 && number.length === 4)
      ) {
        // Single digit numbers go to hinsa
        hinsa.push([number, first, second]);
      } else if (
        /^\d{2}$/.test(number) ||
        (number.includes('+') && number.length <= 3) ||
        (number.split('+').length - 1 === 2 && number.length === 4)
      ) {
        akra.push([number, first, second]);
      } else if (
        /^\d{3}$/.test(number) ||
        (number.length === 4 && number.includes('+'))
      ) {
        tandola.push([number, first, second]);
      } else if (/^\d{4}$/.test(number)) {
        pangora.push([number, first, second]);
      }
    });

    const totalEntries = allVoucherRows.length;

    // Calculate totals for each section
    const calculateSectionTotals = (rows) => {
      return rows.reduce(
        (acc, row) => {
          acc.firstTotal += row[1];
          acc.secondTotal += row[2];
          return acc;
        },
        { firstTotal: 0, secondTotal: 0 }
      );
    };

    const hinsaTotals = calculateSectionTotals(hinsa);
    const akraTotals = calculateSectionTotals(akra);
    const tandolaTotals = calculateSectionTotals(tandola);
    const pangoraTotals = calculateSectionTotals(pangora);

    const grandTotals = {
      firstTotal: hinsaTotals.firstTotal + akraTotals.firstTotal + tandolaTotals.firstTotal + pangoraTotals.firstTotal,
      secondTotal: hinsaTotals.secondTotal + akraTotals.secondTotal + tandolaTotals.secondTotal + pangoraTotals.secondTotal
    };
    const grandTotal = grandTotals.firstTotal + grandTotals.secondTotal;

    const addHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      // Use the passed category if available, otherwise default to 'General'
      doc.text(`Voucher (${category || 'General'})`, pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Dealer Name: ${userData?.user.username} (${userData?.user.dealerId})`, 14, 30);
  doc.text(`City: ${userData?.user.city}`, 14, 40);
  const drawHeaderLabel = selectedDraw ? `${selectedDraw.title} (${new Date(selectedDraw.draw_date).toLocaleDateString()})` : drawDate;
  doc.text(`Draw: ${drawHeaderLabel}`, 14, 50);
      // doc.text(`Draw Time: ${drawTime}`, 14, 60);
      // doc.text(`Total Entries: ${totalEntries}`, 14, 70);

      // Add grand totals
      doc.text(`First Total: ${grandTotals.firstTotal}`, 110, 50);
      doc.text(`Second Total: ${grandTotals.secondTotal}`, 110, 60);
      doc.text(`Grand Total: ${grandTotal}`, 110, 70);
    };

    // Function to render each section using ledger-style 3-column layout (row-wise)
    const renderSection = (title, rows, startY = 80) => {
      if (rows.length === 0) return startY;

      const rowHeight = 8;
      const colWidths = [20, 17, 17];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const xStart = 14;

      let y = startY;

      // Section header with totals
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${title} (${rows.length} entries)`, 14, y);
      y += 8;

      const sectionTotals = calculateSectionTotals(rows);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`First Total: ${sectionTotals.firstTotal}`, 14, y);
      doc.text(`Second Total: ${sectionTotals.secondTotal}`, 60, y);
      doc.text(`Total: ${sectionTotals.firstTotal + sectionTotals.secondTotal}`, 106, y);
      y += 5;

      // Distribute rows row-wise into three columns (0->left,1->middle,2->right,3->left...)
      const leftRows = [];
      const middleRows = [];
      const rightRows = [];
      rows.forEach((r, idx) => {
        if (idx % 3 === 0) leftRows.push(r);
        else if (idx % 3 === 1) middleRows.push(r);
        else rightRows.push(r);
      });

      const leftX = xStart;
      const middleX = leftX + tableWidth;
      const rightX = middleX + tableWidth;

      const drawTableHeader = (x, yy) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        // light gray header background + black border
        doc.setFillColor(230, 230, 230);
        doc.setDrawColor(0, 0, 0);
        // draw header boxes first (fill + stroke)
        doc.rect(x, yy, colWidths[0], rowHeight, 'FD');
        doc.rect(x + colWidths[0], yy, colWidths[1], rowHeight, 'FD');
        doc.rect(x + colWidths[0] + colWidths[1], yy, colWidths[2], rowHeight, 'FD');
        // then draw header labels on top
        doc.setTextColor(0, 0, 0);
        doc.text("Number", x + 1, yy + 5);
        doc.text("First", x + colWidths[0] + 1, yy + 5);
        doc.text("Second", x + colWidths[0] + colWidths[1] + 1, yy + 5);
        // reset fill to white
        doc.setFillColor(255, 255, 255);
        return yy + rowHeight;
      };

      let headerY = drawTableHeader(leftX, y);
      if (middleRows.length > 0) drawTableHeader(middleX, y);
      if (rightRows.length > 0) drawTableHeader(rightX, y);

      let currentY = headerY;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      const maxRows = Math.max(leftRows.length, middleRows.length, rightRows.length);

      for (let i = 0; i < maxRows; i++) {
        if (currentY > pageHeight - 30) {
          doc.addPage();
          // don't print continued title; just redraw headers
          currentY = 35;
          drawTableHeader(leftX, currentY);
          if (middleRows.length > 0) drawTableHeader(middleX, currentY);
          if (rightRows.length > 0) drawTableHeader(rightX, currentY);
          currentY += rowHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
        }

        // left
        if (i < leftRows.length) {
          const [num, f, s] = leftRows[i];
          const entryColor = getEntryColor(num);
          // highlight number cell with light gray background
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(0, 0, 0);
          doc.rect(leftX, currentY, colWidths[0], rowHeight, 'FD');
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), leftX + 1, currentY + 5);
          // reset fill back to white
          doc.setFillColor(255, 255, 255);
          doc.rect(leftX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), leftX + colWidths[0] + 1, currentY + 5);
          doc.rect(leftX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), leftX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        // middle
        if (i < middleRows.length) {
          const [num, f, s] = middleRows[i];
          const entryColor = getEntryColor(num);
          // highlight number cell with light gray background
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(0, 0, 0);
          doc.rect(middleX, currentY, colWidths[0], rowHeight, 'FD');
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), middleX + 1, currentY + 5);
          doc.setFillColor(255, 255, 255);
          doc.rect(middleX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), middleX + colWidths[0] + 1, currentY + 5);
          doc.rect(middleX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), middleX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        

        // right
        if (i < rightRows.length) {
          const [num, f, s] = rightRows[i];
          const entryColor = getEntryColor(num);
          // highlight number cell with light gray background
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(0, 0, 0);
          doc.rect(rightX, currentY, colWidths[0], rowHeight, 'FD');
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), rightX + 1, currentY + 5);
          doc.setFillColor(255, 255, 255);
          doc.rect(rightX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), rightX + colWidths[0] + 1, currentY + 5);
          doc.rect(rightX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), rightX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        currentY += rowHeight;
      }

      return currentY + 15; // Extra space between sections
    };

    addHeader();
    let nextY = 85;

    // Render each section if it has entries
    if (hinsa.length > 0) {
      nextY = renderSection("HINSA", hinsa, nextY);
    }
    if (akra.length > 0) {
      nextY = renderSection("AKRA", akra, nextY);
    }
    if (tandola.length > 0) {
      nextY = renderSection("TANDOLA", tandola, nextY);
    }
    if (pangora.length > 0) {
      nextY = renderSection("PANGORA", pangora, nextY);
    }

    {
      const drawFileLabel = selectedDraw ? `${(selectedDraw.title || 'draw').replace(/\s+/g, '_')}_${new Date(selectedDraw.draw_date).toISOString().split('T')[0]}` : new Date(drawDate).toISOString().split('T')[0];
      doc.save(`Voucher_Sheet_${drawFileLabel}.pdf`);
    }
    toast.success("Voucher PDF by sections downloaded successfully!");
  };

  // end voucher here 

  const generateDemandPDF = async () => {
    // TODO: Implement demand PDF generation
  };

  const generateLedgerPDF = async () => {
    // console.log("Generating Ledger PDF...");

    // user's commison assigned by distributor admin
    // user's share assigned by distributor admin
    // these values come form user data profile 
    // then we can use directly here to calculate 

    const fetchedEntries = await fetchVoucherData(drawDate, drawTime);
    if (fetchedEntries.length === 0) {
      toast("No Record found..");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;

    // Backend returns draw-specific data; no local timeSlot filtering required
    const allVoucherRows = fetchedEntries.flatMap(entry =>
      entry.data.map(item => ({
        number: item.uniqueId,
        first: item.firstPrice,
        second: item.secondPrice
      }))
    );

    const hinsa = [], akra = [], tandola = [], pangora = [];

    allVoucherRows.forEach(({ number, first, second }) => {
      if (/^\d{1}$/.test(number) ||
        (number.includes('+') && number.length === 2) ||
        (number.split('+').length - 1 === 2 && number.length === 3) ||
        (number.split('+').length - 1 === 3 && number.length === 4)
      ) {
        // Single digit numbers go to hinsa
        hinsa.push([number, first, second]);
      } else if (
        /^\d{2}$/.test(number) ||
        (number.includes('+') && number.length <= 3) ||
        (number.split('+').length - 1 === 2 && number.length === 4)
      ) {
        akra.push([number, first, second]);
      } else if (
        /^\d{3}$/.test(number) ||
        (number.length === 4 && number.includes('+'))
      ) {
        tandola.push([number, first, second]);
      } else if (/^\d{4}$/.test(number)) {
        pangora.push([number, first, second]);
      }
    });

    const addHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Ledger Sheet", pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Dealer Name: ${userData?.user.username}`, 14, 30);
  doc.text(`City: ${userData?.user.city}`, 14, 40);
  const drawHeaderLabel = selectedDraw ? `${selectedDraw.title} (${new Date(selectedDraw.draw_date).toLocaleDateString()})` : drawDate;
  doc.text(`Draw: ${drawHeaderLabel}`, 14, 50);
  doc.text(`Draw Time: ${drawTime}`, 14, 60);
      doc.text(`Winning Numbers: `, 14, 70);
      // const winningNumbers = [
      //   { number: "F: 3456", color: [255, 0, 0] },    // Red (RGB)
      //   { number: "S: 6768", color: [0, 0, 255] },    // Blue (RGB)
      //   { number: "S: 7990", color: [0, 0, 255] }     // Blue (RGB)
      // ];

      let xPosition = 14 + doc.getTextWidth("Winning Numbers: "); // Start after the label

      winningNumbers.forEach((item, index) => {
        // Set the color for this number
        doc.setTextColor(item.color[0], item.color[1], item.color[2]);

        // Add the number
        doc.text(item.number, xPosition, 70);

        // Move x position for next number
        xPosition += doc.getTextWidth(item.number);

        // Add comma and space (except for last number)
        if (index < winningNumbers.length - 1) {
          doc.setTextColor(0, 0, 0); // Black for space
          doc.text("    ", xPosition, 70);
          xPosition += doc.getTextWidth("    ");
        }
      });

      // Reset text color to black for subsequent text
      doc.setTextColor(0, 0, 0);
    };

    const calculateTotals = (rows) => {
      return rows.reduce(
        (acc, [, f, s]) => {
          acc.first += f;
          acc.second += s;
          return acc;
        },
        { first: 0, second: 0 }
      );
    };

    // const getEntryColor = (entryNumber) => {
    //   // Check for exact match first
    //   for (const winning of winningNumbers) {
    //     if (entryNumber === winning.number) {
    //       return winning.color;
    //     }
    //   }

    //   // Check for positional matches with + symbols
    //   for (const winning of winningNumbers) {
    //     if (checkPositionalMatch(entryNumber, winning.number)) {
    //       return winning.color;
    //     }
    //   }

    //   return [0, 0, 0]; // Default black color
    // };

    // const checkPositionalMatch = (entry, winningNumber) => {
    //   // Remove any spaces and ensure consistent format
    //   const cleanEntry = entry.toString().trim();

    //   // if (!cleanEntry.includes('+')) {
    //   //   // For plain numbers, only check if they are exact substrings of winning number
    //   //   // AND the entry has '+' patterns or is exactly the winning number
    //   //   return false;
    //   // }
    //   // Handle patterns like +4+6, +34+, etc.
    //   if (cleanEntry.includes('+')) {
    //     // For 2-digit patterns like +4+6
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\+\d$/)) {
    //       const digit1 = cleanEntry[1]; // 4
    //       const digit3 = cleanEntry[3]; // 6

    //       // Check if these digits match positions in winning number
    //       if (winningNumber[1] === digit1 && winningNumber[3] === digit3) {
    //         return true; // Matches positions 2 and 4 of 3456
    //       }
    //     }

    //     // For 3-digit patterns like +45+ (positions 2,3)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\+$/)) {
    //       const digits = cleanEntry.slice(1, 3); // "45"
    //       if (winningNumber.slice(1, 3) === digits) {
    //         return true;
    //       }
    //     }

    //     // For patterns like 3+5+ (positions 1,3)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\d\+\d\+$/)) {
    //       const digit1 = cleanEntry[0];
    //       const digit3 = cleanEntry[2];
    //       if (winningNumber[0] === digit1 && winningNumber[2] === digit3) {
    //         return true;
    //       }
    //     }

    //     // For patterns like ++56 (last two positions)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\+\+\d\d$/)) {
    //       const digits = cleanEntry.slice(2); // "56"
    //       if (winningNumber.slice(2) === digits) {
    //         return true;
    //       }
    //     }

    //     // For patterns like +76+ (checking if 76 appears in positions 2,3 of winning number)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\+$/)) {
    //       const digits = cleanEntry.slice(1, 3); // "76"
    //       if (winningNumber.slice(1, 3) === digits) {
    //         return true;
    //       }
    //     }

    //     // For patterns like 67+8 (checking consecutive positions)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\d\d\+\d$/)) {
    //       const firstTwo = cleanEntry.slice(0, 2); // "67"
    //       const lastDigit = cleanEntry[3]; // "8"
    //       if (winningNumber.slice(0, 2) === firstTwo && winningNumber[3] === lastDigit) {
    //         return true;
    //       }
    //     }

    //     // For patterns like 6+68 (checking positions 1,3,4)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\d\+\d\d$/)) {
    //       const firstDigit = cleanEntry[0]; // "6"
    //       const lastTwo = cleanEntry.slice(2); // "68"
    //       if (winningNumber[0] === firstDigit && winningNumber.slice(2) === lastTwo) {
    //         return true;
    //       }
    //     }

    //     // **NEW: For patterns like +990 (last 3 digits of 4-digit winning number)**
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\d$/)) {
    //       const lastThreeDigits = cleanEntry.slice(1); // "990"
    //       if (winningNumber.slice(1) === lastThreeDigits) { // Check if 7990 ends with 990
    //         return true;
    //       }
    //     }

    //     // **NEW: For patterns like +99 (last 2 digits)**
    //     if (cleanEntry.length === 3 && cleanEntry.match(/^\+\d\d$/)) {
    //       const lastTwoDigits = cleanEntry.slice(1); // "99"
    //       if (winningNumber.slice(-2) === lastTwoDigits) { // Check if 7990 ends with 99
    //         return true;
    //       }
    //     }

    //     // **NEW: For patterns like +9 (last digit)**
    //     if (cleanEntry.length === 2 && cleanEntry.match(/^\+\d$/)) {
    //       const lastDigit = cleanEntry.slice(1); // "9"
    //       if (winningNumber.slice(-1) === lastDigit) { // Check if 7990 ends with 9
    //         return true;
    //       }
    //     }

    //     // Pattern: +8 (matches if 8 appears in position 2,3, or 4 of winning number)
    //     if (cleanEntry.length === 2 && cleanEntry.match(/^\+\d$/)) {
    //       const digit = cleanEntry[1];
    //       // Check positions 2, 3, 4 (indices 1, 2, 3)
    //       for (let i = 1; i < winningNumber.length; i++) {
    //         if (winningNumber[i] === digit) {
    //           return true;
    //         }
    //       }
    //     }

    //     // Pattern: ++8 (matches if 8 appears in position 3 or 4 of winning number)
    //     if (cleanEntry.length === 3 && cleanEntry.match(/^\+\+\d$/)) {
    //       const digit = cleanEntry[2];
    //       // Check positions 3, 4 (indices 2, 3)
    //       for (let i = 2; i < winningNumber.length; i++) {
    //         if (winningNumber[i] === digit) {
    //           return true;
    //         }
    //       }
    //     }

    //     // Pattern: +++8 (matches if 8 appears in position 4 of winning number)
    //     if (cleanEntry.length === 4 && cleanEntry.match(/^\+\+\+\d$/)) {
    //       const digit = cleanEntry[3];
    //       // Check position 4 (index 3)
    //       if (winningNumber[3] === digit) {
    //         return true;
    //       }
    //     }
    //   }


    //   // Check for partial consecutive matches (like 45, 56, etc.)
    //   if (cleanEntry.length >= 2 && cleanEntry.length <= 3 && /^\d+$/.test(cleanEntry)) {
    //     // Only match if the entry starts from the beginning of the winning number
    //     if (winningNumber.startsWith(cleanEntry)) {
    //       return true;
    //     }
    //   }

    //   // **NEW: For single digit numbers without + symbols**
    //   // Pattern: 8 (matches if 8 appears in position 1 of winning number)
    //   if (cleanEntry.length === 1 && /^\d$/.test(cleanEntry)) {
    //     const digit = cleanEntry;
    //     // Check if digit matches first position of winning number
    //     if (winningNumber[0] === digit) {
    //       return true;
    //     }
    //   }

    //   return false;
    // };

    const updateWinningNumbers = (newWinningNumbers) => {
      setWinningNumbers(newWinningNumbers);
    };

    const grandTotals = {
      first: 0,
      second: 0,
      net: 0,
      // commission: 0,
      // payable: 0,
      winningAmount: 0,
      firstWinning: 0,
      secondWinning: 0,
    };

    

    const renderSection = (title, rows, startY = 80) => {
      if (rows.length === 0) return startY;

      const rowHeight = 8;
      const colWidths = [20, 17, 17];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      let y = startY;

      const totals = calculateTotals(rows);
      const net = totals.first + totals.second;

      
      let commissionRate = 0;
      let multiplier = 0;

      const userConfig = userData?.user || {};

      if (title === "HINSA") {
        commissionRate = userConfig.singleFigure;
        multiplier = Number(userConfig.hinsaMultiplier ?? 0) || 0;
      } else if (title === "AKRA") {
        commissionRate = userConfig.doubleFigure;
        multiplier = Number(userConfig.akraMultiplier ?? 0) || 0;
      } else if (title === "TANDOLA") {
        commissionRate = userConfig.tripleFigure;
        multiplier = Number(userConfig.tandolaMultiplier ?? 0) || 0;
      } else if (title === "PANGORA") {
        commissionRate = userConfig.fourFigure;
        multiplier = Number(userConfig.pangoraMultiplier ?? 0) || 0;
      }

      // const commissionAmount = net * commissionRate;
      // const netPayable = net - commissionAmount;

      // Calculate winning amounts for this section
      let firstWinningAmount = 0;
      let secondWinningAmount = 0;
      const secondPrizeDivisor = selectedDraw?.category === 'GTL' ? 5 : 3;

      rows.forEach(([num, f, s]) => {
        const entryColor = getEntryColor(num);

          // Check if this entry is highlighted (has winning color)
          if (entryColor[0] !== 0 || entryColor[1] !== 0 || entryColor[2] !== 0) {
            // Sum over ALL distinct winning numbers that match this entry.
            // This allows one entry (e.g. "12") to win against
            // multiple different winning numbers (129050, 122010, ...).
            for (const winning of winningNumbers) {
              if (num === winning.number || checkPositionalMatch(num, winning.number)) {
                if (winning.type === "first") {
                  firstWinningAmount += f * multiplier;
                } else if (winning.type === "second" || winning.type === "third") {
                  secondWinningAmount += (s * multiplier) / secondPrizeDivisor;
                }
              }
            }
          }
      });

      const totalWinningAmount = firstWinningAmount + secondWinningAmount;

      grandTotals.first += totals.first;
      grandTotals.second += totals.second;
      grandTotals.net += net;
      // grandTotals.commission += commissionAmount;
      // grandTotals.payable += netPayable;
      grandTotals.winningAmount += totalWinningAmount;
      grandTotals.firstWinning += firstWinningAmount;
      grandTotals.secondWinning += secondWinningAmount;

      // Section title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${title} (${rows.length} entries)`, 14, y);
      y += 8;

      // Summary information with winning amount
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`First Total: ${totals.first}`, 14, y);
      doc.text(`Second Total: ${totals.second}`, 60, y);
      doc.text(`Total: ${net}`, 106, y);
      doc.text(`Commission (${commissionRate}%)`, 140, y);
      y += 5;
      doc.text(`Prize Amount: ${totalWinningAmount.toFixed(2)}`, 14, y);
      y += 5;

      // Split rows into three parts
      const thirdPoint = Math.ceil(rows.length / 3);
      const leftRows = rows.slice(0, thirdPoint);
      const middleRows = rows.slice(thirdPoint, thirdPoint * 2);
      const rightRows = rows.slice(thirdPoint * 2);

      // Table positions
      const leftX = 14;
      const middleX = leftX + tableWidth;
      const rightX = middleX + tableWidth;

      // Function to draw table header
      const drawTableHeader = (x, y) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);

        doc.rect(x, y, colWidths[0], rowHeight);
        doc.text("Number", x + 1, y + 5);

        doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
        doc.text("First", x + colWidths[0] + 1, y + 5);

        doc.rect(x + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
        doc.text("Second", x + colWidths[0] + colWidths[1] + 1, y + 5);

        return y + rowHeight;
      };

      // Draw headers for all three tables
      let headerY = drawTableHeader(leftX, y);
      if (middleRows.length > 0) {
        drawTableHeader(middleX, y);
      }
      if (rightRows.length > 0) {
        drawTableHeader(rightX, y);
      }

      // Synchronized drawing of all three tables
      let currentY = headerY;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      const maxRows = Math.max(leftRows.length, middleRows.length, rightRows.length);

      for (let i = 0; i < maxRows; i++) {
        // Check if we need a new page
        if (currentY > 280) {
          doc.addPage();

          // Add section header on new page
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text(title + " (continued...)", 14, 20);

          // Reset Y position and redraw ALL table headers
          currentY = 35;

          // Draw headers for all three tables
          drawTableHeader(leftX, currentY);
          if (middleRows.length > 0) {
            drawTableHeader(middleX, currentY);
          }
          if (rightRows.length > 0) {
            drawTableHeader(rightX, currentY);
          }

          currentY += rowHeight;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
        }

        // Draw left table row
        if (i < leftRows.length) {
          const [num, f, s] = leftRows[i];
          const entryColor = getEntryColor(num);

          doc.rect(leftX, currentY, colWidths[0], rowHeight);
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), leftX + 1, currentY + 5);

          doc.rect(leftX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), leftX + colWidths[0] + 1, currentY + 5);
          doc.rect(leftX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), leftX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        // Draw middle table row
        if (i < middleRows.length) {
          const [num, f, s] = middleRows[i];
          const entryColor = getEntryColor(num);

          doc.rect(middleX, currentY, colWidths[0], rowHeight);
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), middleX + 1, currentY + 5);

          doc.rect(middleX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), middleX + colWidths[0] + 1, currentY + 5);
          doc.rect(middleX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), middleX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        // Draw right table row
        if (i < rightRows.length) {
          const [num, f, s] = rightRows[i];
          const entryColor = getEntryColor(num);

          doc.rect(rightX, currentY, colWidths[0], rowHeight);
          doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]);
          doc.text(num.toString(), rightX + 1, currentY + 5);

          doc.rect(rightX + colWidths[0], currentY, colWidths[1], rowHeight);
          doc.text(f.toString(), rightX + colWidths[0] + 1, currentY + 5);
          doc.rect(rightX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
          doc.text(s.toString(), rightX + colWidths[0] + colWidths[1] + 1, currentY + 5);
          doc.setTextColor(0, 0, 0);
        }

        currentY += rowHeight;
      }

      return currentY + 10;
    };

    const renderGrandTotals = (startY = 270) => {
      if (startY > 250) {
        doc.addPage();
        startY = 30;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Grand Totals Summary", 14, startY);
      startY += 8;

      const rowHeight = 8;
      const colWidths = [60, 30, 30, 40];
      const xStart = 14;

      const drawRow = (y, label, first, second, total) => {
        doc.setFont("helvetica", "normal");
        doc.rect(xStart, y, colWidths[0], rowHeight);
        doc.text(label, xStart + 2, y + 6);
        doc.rect(xStart + colWidths[0], y, colWidths[1], rowHeight);
        doc.text(first.toFixed(2), xStart + colWidths[0] + 2, y + 6);
        doc.rect(xStart + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
        doc.text(second.toFixed(2), xStart + colWidths[0] + colWidths[1] + 2, y + 6);
        doc.rect(xStart + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], rowHeight);
        doc.text(total.toFixed(2), xStart + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 6);
      };

      const grandFirst = grandTotals.first;
      const grandSecond = grandTotals.second;
      const netTotal = grandFirst + grandSecond;

      // const commissionFirst = (grandFirst / netTotal) * grandTotals.commission;
      // const commissionSecond = (grandSecond / netTotal) * grandTotals.commission;

      // const netFirst = grandFirst - commissionFirst;
      // const netSecond = grandSecond - commissionSecond;

      let y = startY;

      doc.setFont("helvetica", "bold");
      doc.rect(xStart, y, colWidths[0], rowHeight);
      doc.text("Label", xStart + 2, y + 6);
      doc.rect(xStart + colWidths[0], y, colWidths[1], rowHeight);
      doc.text("First", xStart + colWidths[0] + 2, y + 6);
      doc.rect(xStart + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
      doc.text("Second", xStart + colWidths[0] + colWidths[1] + 2, y + 6);
      doc.rect(xStart + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], rowHeight);
      doc.text("Total/Payable", xStart + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 6);

      y += rowHeight;
      drawRow(y, "Grand Total", grandFirst, grandSecond, netTotal);
      // y += rowHeight;
      // drawRow(y, "Commission", -commissionFirst, -commissionSecond, -grandTotals.commission);
      // y += rowHeight;
      // drawRow(y, "Net Payable", netFirst, netSecond, grandTotals.payable);
      y += rowHeight;
      drawRow(y, "Winning Amount", grandTotals.firstWinning, grandTotals.secondWinning, grandTotals.winningAmount);
    };

    addHeader();
    let nextY = 80;
    nextY = renderSection("HINSA", hinsa, nextY);
    nextY = renderSection("AKRA", akra, nextY);
    nextY = renderSection("TANDOLA", tandola, nextY);
    nextY = renderSection("PANGORA", pangora, nextY);
    renderGrandTotals(nextY);

    {
      const drawFileLabel = selectedDraw ? `${(selectedDraw.title || 'draw').replace(/\s+/g, '_')}_${new Date(selectedDraw.draw_date).toISOString().split('T')[0]}` : new Date(drawDate).toISOString().split('T')[0];
      doc.save(`Ledger_Sheet_${drawFileLabel}.pdf`);
    }
    toast.success("Ledger PDF downloaded successfully!");
  };

  const generateDailyBillPDF2 = async () => {
    console.log("Generating Daily Bill PDF...");

    const fetchedEntries = await fetchVoucherData(drawDate, drawTime);
    if (!Array.isArray(fetchedEntries) || fetchedEntries.length === 0) {
      toast("No record found for the selected date.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Daily Bill", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Dealer: ${userData?.user.username}`, 14, 30);
    doc.text(`City: ${userData?.user.city}`, 14, 40);
  const drawHeaderLabel2 = selectedDraw ? `${selectedDraw.title} (${new Date(selectedDraw.draw_date).toLocaleDateString()})` : drawDate;
  doc.text(`Draw: ${drawHeaderLabel2}`, 14, 50);

    const allData = fetchedEntries.flatMap(entry => entry.data);

    let y = 70;
    const rowHeight = 10;
    const colWidths = [60, 60];
    const x = 14;

    // Table Header with box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.rect(x, y, colWidths[0], rowHeight);
    doc.text("Draw Time", x + 2, y + 7);
    doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
    doc.text("SALE", x + colWidths[0] + 2, y + 7);
    y += rowHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const dailyGrandTotal = allData.reduce((sum, item) => sum + (item.firstPrice || 0) + (item.secondPrice || 0), 0);

    // Single row summary for the selected draw
    doc.rect(x, y, colWidths[0], rowHeight);
    doc.text(drawHeaderLabel2, x + 2, y + 7);

    doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
    doc.text(dailyGrandTotal.toString(), x + colWidths[0] + 2, y + 7);

    y += rowHeight;

    // Final Grand Total in styled box
    // y += 10;
    // doc.setFont("helvetica", "bold");
    // doc.rect(x, y, colWidths[0], rowHeight);
    // doc.text("Daily Grand Total:", x + 2, y + 7);
    // doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
    // doc.text(dailyGrandTotal.toString(), x + colWidths[0] + 2, y + 7);

    {
      const drawFileLabel = selectedDraw ? `${(selectedDraw.title || 'draw').replace(/\s+/g, '_')}_${new Date(selectedDraw.draw_date).toISOString().split('T')[0]}` : new Date(drawDate).toISOString().split('T')[0];
      doc.save(`Daily_Bill_${drawFileLabel}.pdf`);
    }
    toast.success("Daily Bill PDF downloaded successfully!");
  };


  const getEntryColor = (entryNumber) => {
    // Check for exact match first
    for (const winning of winningNumbers) {
      if (entryNumber === winning.number) {
        return winning.color;
      }
    }

    // Check for positional matches with + symbols
    for (const winning of winningNumbers) {
      if (checkPositionalMatch(entryNumber, winning.number)) {
        return winning.color;
      }
    }

    return [0, 0, 0]; // Default black color
  };

  const checkPositionalMatch = (entry, winningNumber) => {
    // Remove any spaces and ensure consistent format
    const cleanEntry = entry.toString().trim();
    const win = String(winningNumber ?? '').trim().padStart(4, '0').slice(-4);

    // Strict single-digit positional rules:
    // 7 -> pos1, +7 -> pos2, ++7 -> pos3, +++7 -> pos4
    const strictSingleDigit = cleanEntry.match(/^(\+{0,3})(\d)$/);
    if (strictSingleDigit) {
      const plusCount = strictSingleDigit[1].length;
      const digit = strictSingleDigit[2];
      return win[plusCount] === digit;
    }

    // if (!cleanEntry.includes('+')) {
    //   // For plain numbers, only check if they are exact substrings of winning number
    //   // AND the entry has '+' patterns or is exactly the winning number
    //   return false;
    // }
    // Handle patterns like +4+6, +34+, etc.
    if (cleanEntry.includes('+')) {
      // For 2-digit patterns like +4+6
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\+\d$/)) {
        const digit1 = cleanEntry[1]; // 4
        const digit3 = cleanEntry[3]; // 6

        // Check if these digits match positions in winning number
        if (winningNumber[1] === digit1 && winningNumber[3] === digit3) {
          return true; // Matches positions 2 and 4 of 3456
        }
      }

      // For 3-digit patterns like +45+ (positions 2,3)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\+$/)) {
        const digits = cleanEntry.slice(1, 3); // "45"
        if (winningNumber.slice(1, 3) === digits) {
          return true;
        }
      }

      // For patterns like 3+5+ (positions 1,3)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\d\+\d\+$/)) {
        const digit1 = cleanEntry[0];
        const digit3 = cleanEntry[2];
        if (winningNumber[0] === digit1 && winningNumber[2] === digit3) {
          return true;
        }
      }

      // For patterns like ++56 (last two positions)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\+\d\d$/)) {
        const digits = cleanEntry.slice(2); // "56"
        if (winningNumber.slice(2) === digits) {
          return true;
        }
      }

      // For patterns like +76+ (checking if 76 appears in positions 2,3 of winning number)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\+$/)) {
        const digits = cleanEntry.slice(1, 3); // "76"
        if (winningNumber.slice(1, 3) === digits) {
          return true;
        }
      }

      // For patterns like 67+8 (checking consecutive positions)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\d\d\+\d$/)) {
        const firstTwo = cleanEntry.slice(0, 2); // "67"
        const lastDigit = cleanEntry[3]; // "8"
        if (winningNumber.slice(0, 2) === firstTwo && winningNumber[3] === lastDigit) {
          return true;
        }
      }

      // For patterns like 6+68 (checking positions 1,3,4)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\d\+\d\d$/)) {
        const firstDigit = cleanEntry[0]; // "6"
        const lastTwo = cleanEntry.slice(2); // "68"
        if (winningNumber[0] === firstDigit && winningNumber.slice(2) === lastTwo) {
          return true;
        }
      }

      // **NEW: For patterns like +990 (last 3 digits of 4-digit winning number)**
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\d$/)) {
        const lastThreeDigits = cleanEntry.slice(1); // "990"
        if (winningNumber.slice(1) === lastThreeDigits) { // Check if 7990 ends with 990
          return true;
        }
      }

      // **NEW: For patterns like +99 (last 2 digits)**
      if (cleanEntry.length === 3 && cleanEntry.match(/^\+\d\d$/)) {
        const lastTwoDigits = cleanEntry.slice(1); // "99"
        if (winningNumber.slice(-2) === lastTwoDigits) { // Check if 7990 ends with 99
          return true;
        }
      }

      // **NEW: For patterns like +9 (last digit)**
      if (cleanEntry.length === 2 && cleanEntry.match(/^\+\d$/)) {
        const lastDigit = cleanEntry.slice(1); // "9"
        if (winningNumber.slice(-1) === lastDigit) { // Check if 7990 ends with 9
          return true;
        }
      }

      // Pattern: +8 (matches if 8 appears in position 2,3, or 4 of winning number)
      if (cleanEntry.length === 2 && cleanEntry.match(/^\+\d$/)) {
        const digit = cleanEntry[1];
        // Check positions 2, 3, 4 (indices 1, 2, 3)
        for (let i = 1; i < winningNumber.length; i++) {
          if (winningNumber[i] === digit) {
            return true;
          }
        }
      }

      // Pattern: ++8 (matches if 8 appears in position 3 or 4 of winning number)
      if (cleanEntry.length === 3 && cleanEntry.match(/^\+\+\d$/)) {
        const digit = cleanEntry[2];
        // Check positions 3, 4 (indices 2, 3)
        for (let i = 2; i < winningNumber.length; i++) {
          if (winningNumber[i] === digit) {
            return true;
          }
        }
      }

      // Pattern: +++8 (matches if 8 appears in position 4 of winning number)
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\+\+\d$/)) {
        const digit = cleanEntry[3];
        // Check position 4 (index 3)
        if (winningNumber[3] === digit) {
          return true;
        }
      }
    }


    // Special handling for 4-digit plain numbers (PANGORA section):
    // treat them as matching if they equal either the first 4 or the
    // last 4 digits of the 6-digit winning number.
    if (cleanEntry.length === 4 && /^\d{4}$/.test(cleanEntry)) {
      const winStr = winningNumber.toString().trim();
      if (winStr.length >= 4 && winStr.slice(0, 4) === cleanEntry) {
        return true;
      }
    }

    // Check for partial consecutive matches (like 45, 56, etc.) for
    // 2- and 3-digit plain numbers.
    if (cleanEntry.length >= 2 && cleanEntry.length <= 3 && /^\d+$/.test(cleanEntry)) {
      // Only match if the entry starts from the beginning of the winning number
      if (winningNumber.startsWith(cleanEntry)) {
        return true;
      }
    }

    // **NEW: For single digit numbers without + symbols**
    // Pattern: 8 (matches if 8 appears in position 1 of winning number)
    if (cleanEntry.length === 1 && /^\d$/.test(cleanEntry)) {
      const digit = cleanEntry;
      // Check if digit matches first position of winning number
      if (winningNumber[0] === digit) {
        return true;
      }
    }

    return false;
  };



  const handleDownloadPDF = async () => {
    // Require a selected draw for PDF generation so PDFs reflect the admin-selected draw date
    if (!selectedDraw) {
      toast.error("Please select a draw before downloading PDFs.");
      return;
    }

    // Prevent PDF generation until draw is closed
    if (!isSelectedDrawClosed()) {
      toast.error("Draw is not close yet");
      return;
    }

    if (ledger === "VOUCHER") {
      await generateVoucherPDF();
    }
    else if (ledger === "LEDGER") {

      await generateLedgerPDF();

    }
    else if (ledger === "DAILY BILL") {
      await generateDailyBillPDF();
    }
    // else if (ledger === "DEMAND") {
    //   await generateVoucherPDF("demand");
    // }
    // else if (ledger === "OVER LIMIT") {
    //   await generateVoucherPDF("overlimit");
    // }
    else if (ledger === "COMBINED") {
      await generateCombinedVoucherPDF();
    }
    else if (ledger === "COMBINED DEMAND") {
      await generateCombinedVoucherPDF("demand");
    }
    else if (ledger === "COMBINED OVER LIMIT") {
      await generateCombinedVoucherPDF("overlimit");
    }
    else {
      toast.error("Please select a valid ledger type.");

    }


  };

  const generateDailyBillPDF = async () => {
    console.log("Generating Daily Bill PDF...");

    const fetchedEntries = await fetchVoucherData(drawDate, drawTime);
    if (!Array.isArray(fetchedEntries) || fetchedEntries.length === 0) {
      toast("No record found for the selected date.");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Daily Bill", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Dealer: ${userData?.user.username}`, 14, 30);
    doc.text(`City: ${userData?.user.city}`, 14, 40);
  const drawHeaderLabel3 = selectedDraw ? `${selectedDraw.title} (${new Date(selectedDraw.draw_date).toLocaleDateString()})` : drawDate;
  doc.text(`Draw: ${drawHeaderLabel3}`, 14, 50);

    // Initialize grand totals for the day
    const dayGrandTotals = {
      first: 0,
      second: 0,
      net: 0,
      winningAmount: 0,
      firstWinning: 0,
      secondWinning: 0,
    };

    // Group by time slot. If a time slot is selected (timeSlotId mode), backend returns Data docs
    // without timeSlot; treat all returned data as belonging to the selected draw.
    const groupedByTimeSlot = {};
    if (selectedDraw && selectedDraw._id) {
      const key = selectedDraw.title || 'Draw';
      groupedByTimeSlot[key] = fetchedEntries.flatMap(entry => entry.data);
    } else {
      fetchedEntries.forEach(entry => {
        const slot = entry.timeSlot;
        if (!groupedByTimeSlot[slot]) {
          groupedByTimeSlot[slot] = [];
        }
        groupedByTimeSlot[slot].push(...entry.data);
      });
    }

    let y = 70;
    const rowHeight = 10;
    const colWidths = [40, 30, 30, 30, 30, 30];
    const x = 14;

    // Enhanced Table Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    // Draw header boxes
    doc.rect(x, y, colWidths[0], rowHeight);
    doc.text("Draw Time", x + 2, y + 7);

    doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
    doc.text("SALE", x + colWidths[0] + 2, y + 7);

    doc.rect(x + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
    doc.text("PRIZE", x + colWidths[0] + colWidths[1] + 2, y + 7);

    doc.rect(x + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], rowHeight);
    doc.text("SUB TOTAL", x + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 7);

    doc.rect(x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, colWidths[4], rowHeight);
    doc.text("Share (45%)", x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 7);

    doc.rect(x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y, colWidths[5], rowHeight);
    doc.text("Bill", x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 2, y + 7);

    y += rowHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Calculate winning amounts helper function
    const calculateWinningForTimeSlot = (entries) => {
      const allVoucherRows = entries.map(item => ({
        number: item.uniqueId,
        first: item.firstPrice,
        second: item.secondPrice
      }));

      const hinsa = [], akra = [], tandola = [], pangora = [];

      // Categorize entries
      allVoucherRows.forEach(({ number, first, second }) => {
        if (/^\d{1}$/.test(number)) {
          hinsa.push([number, first, second]);
        } else if (
          /^\d{2}$/.test(number) ||
          /^\+\d$/.test(number) ||
          /^\+\+\d$/.test(number) ||
          /^\+\+\+\d$/.test(number) ||
          (number.includes('+') && number.length <= 4)
        ) {
          akra.push([number, first, second]);
        } else if (
          /^\d{3}$/.test(number) ||
          (number.length === 4 && number.includes('x'))
        ) {
          tandola.push([number, first, second]);
        } else if (/^\d{4}$/.test(number)) {
          pangora.push([number, first, second]);
        }
      });

      // Calculate winning amounts for each category
      const calculateSectionWinning = (rows, multiplier) => {
        let firstWinningAmount = 0;
        let secondWinningAmount = 0;
        const secondPrizeDivisor = selectedDraw?.category === 'GTL' ? 5 : 3;

        rows.forEach(([num, f, s]) => {
          const entryColor = getEntryColor(num);

          if (entryColor[0] !== 0 || entryColor[1] !== 0 || entryColor[2] !== 0) {
            // Sum over ALL distinct winning numbers that match this entry
            // so that one entry can win multiple times if there are
            // multiple different winning numbers sharing the same position.
            for (const winning of winningNumbers) {
              if (num === winning.number || checkPositionalMatch(num, winning.number)) {
                if (winning.type === "first") {
                  firstWinningAmount += f * multiplier;
                } else if (winning.type === "second" || winning.type === "third") {
                  secondWinningAmount += (s * multiplier) / secondPrizeDivisor;
                }
              }
            }
          }
        });

        return firstWinningAmount + secondWinningAmount;
      };

      const hinsaWinning = calculateSectionWinning(hinsa, 8);
      const akraWinning = calculateSectionWinning(akra, 80);
      const tandolaWinning = calculateSectionWinning(tandola, 800);
      const pangoraWinning = calculateSectionWinning(pangora, 8000);

      return hinsaWinning + akraWinning + tandolaWinning + pangoraWinning;
    };

    // Process each time slot
    Object.entries(groupedByTimeSlot).forEach(([timeSlot, entries]) => {
      const firstTotal = entries.reduce((sum, item) => sum + item.firstPrice, 0);
      const secondTotal = entries.reduce((sum, item) => sum + item.secondPrice, 0);
      const totalSale = firstTotal + secondTotal;
      const winningAmount = calculateWinningForTimeSlot(entries);
      const subtotal = totalSale - winningAmount;
      const shareAmount = subtotal * 0.45; // 45% share amount
      const billAmount = subtotal - shareAmount; // Bill amount after share deduction
      // Add to day totals
      dayGrandTotals.first += firstTotal;
      dayGrandTotals.second += secondTotal;
      dayGrandTotals.net += totalSale;
      dayGrandTotals.winningAmount += winningAmount;

      // Draw row
      doc.rect(x, y, colWidths[0], rowHeight);
      doc.text(timeSlot, x + 2, y + 7);

      doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
      doc.text(totalSale.toString(), x + colWidths[0] + 2, y + 7);

      doc.rect(x + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
      doc.text(winningAmount.toFixed(2), x + colWidths[0] + colWidths[1] + 2, y + 7);

      doc.rect(x + colWidths[0] + colWidths[1] + colWidths[2], y, colWidths[3], rowHeight);
      doc.text(subtotal.toString(), x + colWidths[0] + colWidths[1] + colWidths[2] + 2, y + 7);

      doc.rect(x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, colWidths[4], rowHeight);
      doc.text(shareAmount.toString(), x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, y + 7);

      doc.rect(x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y, colWidths[5], rowHeight);
      doc.text(billAmount.toFixed(2), x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 2, y + 7);

      y += rowHeight;

      
    });

    

    doc.save("Daily_Bill_RLC.pdf");
    toast.success("Daily Bill PDF downloaded successfully!");
  };

  const isPastClosingTime = () => {
    // Use admin-configured draw date / expired flag only (no time-slot logic)
    if (!selectedDraw) return false;

    if (selectedDraw.isExpired) return true;

    if (!selectedDraw.draw_date) return false;

    const drawDateObj = new Date(selectedDraw.draw_date);
    drawDateObj.setHours(23, 59, 59, 999); // end of draw day
    return currentTime >= drawDateObj;
  };

  // Main Content




  return (
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden w-full" style={{ minHeight: 'calc(100vh - 96px)', width: '100%', boxSizing: 'border-box', paddingLeft: 0 }}>

      <Box sx={{ width: '100%', maxWidth: 1320, mx: 0, display: 'flex', gap: { xs: 1.25, md: 1.5 }, alignItems: 'flex-start', mt: 1.25, px: { xs: 1.25, sm: 2 } }}>
        
        {/* <Box sx={{ flex: 1 }}>
          {userData?.user?.role === 'distributor' ? (
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-md text-white">
              <h3 className="text-lg font-semibold mb-3">Distributor View</h3>
            </div>
          ) : (
            <div>
              
            </div>
          )}
        </Box> */}

        <Box component={Paper} sx={{ display: 'flex', flexWrap: { xs: 'wrap', lg: 'nowrap' }, alignItems: 'center', justifyContent: 'space-between', rowGap: 0.75, columnGap: 0.75, width: '100%', bgcolor: 'grey.800', color: 'common.white', p: { xs: 0.7, md: 0.85 }, borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, width: { xs: '100%', lg: 'auto' }, flexShrink: 0 }}>
            <FaBalanceScale className="text-blue-400" style={{ fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ color: 'grey.200', fontWeight: 700, mr: 1, letterSpacing: 0.6 }}>BALANCE</Typography>
            <Box sx={{ bgcolor: 'grey.900', px: { xs: 1.25, md: 2 }, py: 0.6, borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)', minWidth: { xs: 118, sm: 145 }, textAlign: 'right' }}>
              <Typography variant="h6" sx={{ color: 'grey.100', fontWeight: 800, fontSize: '1.05rem' }}>
                {(() => { const raw = userData?.user?.balance; const num = Number(raw); return !isNaN(num) ? num.toLocaleString() : (raw ?? '-'); })()}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flex: 1, justifyContent: { xs: 'flex-start', lg: 'center' }, minWidth: 0, width: { xs: '100%', lg: 'auto' } }}>
              <Box sx={{ display: 'flex', gap: 0.6, alignItems: 'center', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
              <Box sx={{ bgcolor: 'grey.900', px: { xs: 1.1, md: 1.8 }, py: 0.55, borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', minWidth: { xs: 68, sm: 82 } }}>
                <Typography variant="body2" sx={{ color: 'grey.400', fontWeight: 600, mb: 0.25 }}>Count</Typography>
                <Typography variant="subtitle1" sx={{ color: 'grey.100', fontWeight: 800 }}>{distributorRecordCount}</Typography>
              </Box>
              <Box sx={{ bgcolor: 'grey.900', px: { xs: 1.1, md: 1.8 }, py: 0.55, borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', minWidth: { xs: 68, sm: 82 } }}>
                <Typography variant="body2" sx={{ color: 'grey.400', fontWeight: 600, mb: 0.25 }}>Total</Typography>
                <Typography variant="subtitle1" sx={{ color: 'grey.100', fontWeight: 800 }}>{(() => { const n = Number(distributorGrandTotal); return !isNaN(n) ? n.toLocaleString() : '-'; })()}</Typography>
              </Box>
              <Box sx={{ bgcolor: 'grey.900', px: { xs: 1.1, md: 1.8 }, py: 0.55, borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', minWidth: { xs: 68, sm: 82 } }}>
                <Typography variant="body2" sx={{ color: 'grey.400', fontWeight: 600, mb: 0.25 }}>First</Typography>
                <Typography variant="subtitle1" sx={{ color: 'grey.100', fontWeight: 800 }}>{(() => { const n = Number(distributorFirstTotal); return !isNaN(n) ? n.toLocaleString() : '-'; })()}</Typography>
              </Box>
              <Box sx={{ bgcolor: 'grey.900', px: { xs: 1.1, md: 1.8 }, py: 0.55, borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', minWidth: { xs: 68, sm: 82 } }}>
                <Typography variant="body2" sx={{ color: 'grey.400', fontWeight: 600, mb: 0.25 }}>Second</Typography>
                <Typography variant="subtitle1" sx={{ color: 'grey.100', fontWeight: 800 }}>{(() => { const n = Number(distributorSecondTotal); return !isNaN(n) ? n.toLocaleString() : '-'; })()}</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: { xs: 'wrap', lg: 'nowrap' }, gap: 0.6, minWidth: { xs: '100%', lg: 190 }, justifyContent: { xs: 'flex-start', lg: 'flex-end' }, width: { xs: '100%', lg: 'auto' }, flexShrink: 0 }}>
            <input type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} style={{ background: 'transparent', color: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', outline: 'none', minWidth: '132px', flex: '1 1 132px' }} />

            <select
              value={selectedDraw?._id || ""}
              onChange={(e) => {
                const d = draws.find(x => String(x._id) === String(e.target.value));
                setSelectedDraw(d || null);
                if (d && d.isActive === false) {
                  toast.error('Time slot is closed');
                }
              }}
              style={{ background: 'transparent', color: selectedDraw ? '#000' : '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', minWidth: '148px', flex: '1 1 148px' }}
            >
              <option value="" style={{ color: '#fff' }}>-- Select Time Slot --</option>
              {Array.isArray(draws) && draws.slice().sort((a,b)=>{
                const ah = typeof a.hour === 'number' ? a.hour : (parseInt((a.label||'').match(/^(\d{1,2})/)?.[1]||'0',10));
                const bh = typeof b.hour === 'number' ? b.hour : (parseInt((b.label||'').match(/^(\d{1,2})/)?.[1]||'0',10));
                return ah - bh;
              }).map(d => (
                <option key={d._id} value={d._id} style={{ color: '#000' }}>{formatTimeSlotLabel(d)}{d.isActive === false ? ' (Closed)' : d.isActive === true ? ' (Active)' : ''}</option>
              ))}
            </select>

            <Button variant="outlined" color="inherit" sx={{ minWidth: { xs: 90, sm: 96 }, whiteSpace: 'nowrap' }} onClick={() => {
              if (selectedDraw && selectedDraw.isActive === false) {
                toast.error('Selected time slot is closed.');
                return;
              }
              getAndSetVoucherData();
            }}>Load</Button>
          </Box>
        </Box>

        
      </Box> 

      {/* Two-column section: left = Table, right = Action Buttons */}
      <Box sx={{ width: '100%', maxWidth: 1320, mx: 0, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: { xs: 2, lg: 2 }, alignItems: 'stretch', mt: 1.75, px: { xs: 1.25, sm: 2 } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper
            elevation={3}
            sx={{
              bgcolor: '#111318',
              color: '#F9FAFB',
              minHeight: { xs: '54vh', md: '56vh' },
              height: { xs: 'auto', lg: 'calc(100vh - 205px)' },
              maxHeight: { lg: 'calc(100vh - 175px)' },
              p: { xs: 1.35, md: 1.5 },
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >

            {/* Table Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
                <Button variant="contained" color="error" onClick={openDeleteSelectedConfirm} disabled={isDistributorSearchView} sx={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2, px: 2 }}>Delete Selected</Button>
                <Button variant="contained" color="success" onClick={handleCopySelected} sx={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2, px: 2 }}>Copy</Button>
                <Button variant="contained" color="primary" onClick={handlePasteCopied} sx={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2, px: 2 }}>Paste</Button>
                <Button variant="contained" color="secondary" onClick={() => { setSmsInput(""); setParsedEntries([]); setShowModal(true); }} sx={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2, px: 2 }}>Paste SMS</Button>
                <TextField
                  size="small"
                  label="Search Number"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  placeholder="Type NO..."
                  sx={{
                    minWidth: { xs: 180, sm: 200 },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.30)' },
                      '&.Mui-focused fieldset': { borderColor: '#60A5FA' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.72)' } }}
                />
              </Box>
            </Box>

            {(() => {
              const flat = Object.entries(groupedEntries).flatMap(([parentId, group]) =>
                group.map((entry, idx) => ({ ...entry, parentId, isGroupStart: idx === 0 }))
              );
              const noDataMessage = isSearchActive
                ? (searchLoading ? 'Searching entries...' : 'No matching NO entries found.')
                : 'No records found for the selected time slot / date.';

              if (!flat || flat.length === 0) {
                return (
                    <TableContainer
                      ref={tableContainerRef}
                      sx={{
                        flex: 1,
                        height: '100%',
                        minHeight: 0,
                        overflowY: 'auto',
                        overflowX: 'auto',
                        scrollBehavior: 'smooth',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: 1.5,
                        bgcolor: '#0E1117',
                        pb: 0,
                      }}
                    >
                    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: 620 }}>
                      <colgroup>
                        <col style={{ width: '56px' }} />
                        <col style={{ width: isDistributorSearchView ? '38%' : '46%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        {isDistributorSearchView && <col style={{ width: '18%' }} />}
                        <col style={{ width: isDistributorSearchView ? '12%' : '18%' }} />
                      </colgroup>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>
                            <Checkbox disabled />
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>Number</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>1st</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>2nd</TableCell>
                          {isDistributorSearchView && (
                            <TableCell sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>Client</TableCell>
                          )}
                          <TableCell align="center" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={isDistributorSearchView ? 6 : 5} sx={{ textAlign: 'center', py: 6, color: 'grey.400' }}>
                            {noDataMessage}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              }

              return (
                <TableContainer
                  ref={tableContainerRef}
                  sx={{
                    flex: 1,
                    height: '100%',
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    scrollBehavior: 'smooth',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 1.5,
                    bgcolor: '#0E1117',
                    pb: 0,
                  }}
                >
                  <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: 620, '& .MuiTableRow-root': { height: { xs: 48, lg: 46 } } }}>
                    <colgroup>
                      <col style={{ width: '56px' }} />
                      <col style={{ width: isDistributorSearchView ? '38%' : '46%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '16%' }} />
                      {isDistributorSearchView && <col style={{ width: '18%' }} />}
                      <col style={{ width: isDistributorSearchView ? '12%' : '18%' }} />
                    </colgroup>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>
                          <Checkbox
                            checked={
                              Object.values(groupedEntries)
                                .flat()
                                .length > 0 &&
                              Object.values(groupedEntries)
                                .flat()
                                .every(entry => selectedEntries.includes(entry.objectId || entry.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allIds = Object.values(groupedEntries).flat().map(entry => entry.objectId || entry.id);
                                setSelectedEntries(allIds);
                              } else {
                                setSelectedEntries([]);
                              }
                            }}
                            sx={{ color: 'rgba(255,255,255,0.75)', '&.Mui-checked': { color: '#60A5FA' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>Number</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>1st</TableCell>
                        <TableCell align="right" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>2nd</TableCell>
                        {isDistributorSearchView && (
                          <TableCell sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>Client</TableCell>
                        )}
                        <TableCell align="center" sx={{ bgcolor: '#161B22', color: '#F3F4F6', fontSize: '0.92rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 2 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody sx={{ '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.02)' }, '& .MuiTableRow-root:hover': { bgcolor: 'rgba(96,165,250,0.08)' } }}>
                      {flat.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isDistributorSearchView ? 6 : 5} sx={{ textAlign: 'center', py: 6, color: 'grey.400' }}>
                            {noDataMessage}
                          </TableCell>
                        </TableRow>
                      ) : (
                        flat.map((row) => (
                          <TableRow key={row.objectId || row._tempId || row.id} hover sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={selectedEntries.includes(row.objectId || row.id)} onChange={() => toggleSelectEntry(row.objectId || row.id)} sx={{ color: 'rgba(255,255,255,0.75)', '&.Mui-checked': { color: '#60A5FA' } }} />
                            </TableCell>
                            <TableCell sx={{ color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.98rem', fontWeight: 500 }}>{row.no}</TableCell>
                            <TableCell align="right" sx={{ color: '#FFFFFF', fontSize: '0.98rem', fontWeight: 500 }}>{row.f}</TableCell>
                            <TableCell align="right" sx={{ color: '#FFFFFF', fontSize: '0.98rem', fontWeight: 500 }}>{row.s}</TableCell>
                            {isDistributorSearchView && (
                              <TableCell sx={{ color: '#E5E7EB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.92rem' }}>
                                {row.clientName || '-'}
                              </TableCell>
                            )}
                            <TableCell align="center">
                              {row.isGroupStart && !isDistributorSearchView && (
                                <IconButton aria-label="delete" size="small" onClick={() => openDeleteConfirm(row.parentId)} sx={{ bgcolor: 'error.main', color: 'common.white', '&:hover': { bgcolor: 'error.dark' }, minWidth: 40, height: 32, borderRadius: 1 }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              );
            })()}

            {userData?.user?.role === 'distributor' ? (
              <Paper elevation={2} sx={{ mt: 'auto', p: 2, bgcolor: 'grey.800' }}>
                <Typography variant="h6" sx={{ color: 'grey.100', mb: 1 }}>Distributor (Entries Disabled)</Typography>
                <Typography variant="body2" sx={{ color: 'grey.300' }}>Distributors cannot add entries from this panel.</Typography>
              </Paper>
            ) : (
              <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSingleEntrySubmit(); }} sx={{ mt: 0.5, pt: 0.5, overflowX: 'hidden', bgcolor: 'grey.800', p: 1.1, borderTop: '1px solid rgba(255,255,255,0.12)', position: 'sticky', bottom: 0, zIndex: 6, flexShrink: 0, boxShadow: '0 -8px 20px rgba(0,0,0,0.45)' }}>
                <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: { xs: 1, md: 1.25, lg: 1.5 }, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(130px, 1fr))', lg: 'minmax(180px, 1.15fr) minmax(125px, 1fr) minmax(125px, 1fr)' }, gap: 1, flex: 1, minWidth: 0 }}>
                    <TextField
                      inputRef={noInputRef}
                      value={no}
                      onKeyDown={handleNoKeyDown}
                      label="NO"
                      variant="outlined"
                      size="medium"
                      inputProps={{ maxLength: 16, inputMode: 'text', pattern: '^[+0-9]+$' }}
                      onChange={(e) => {
                        const raw = e.target.value || '';
                        const cleaned = raw.replace(/[^+0-9]/g, '');
                        let plusCount = 0;
                        let digitCount = 0;
                        let out = '';
                        for (const ch of cleaned) {
                          if (ch === '+') {
                            if (plusCount < 3) { out += '+'; plusCount++; }
                          } else {
                            if (digitCount < 10) { out += ch; digitCount++; }
                          }
                        }
                        setNo(out);
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
                        const cleaned = text.replace(/[^+0-9]/g, '');
                        let plusCount = 0;
                        let digitCount = 0;
                        let out = '';
                        for (const ch of cleaned) {
                          if (ch === '+') {
                            if (plusCount < 3) { out += '+'; plusCount++; }
                          } else {
                            if (digitCount < 10) { out += ch; digitCount++; }
                          }
                        }
                        setNo(out);
                      }}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderRadius: 1,
                          minHeight: 42,
                          height: 42,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
                          '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                        },
                        '& .MuiInputBase-input': { fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)', fontSize: '0.95rem', fontWeight: 500 },
                        '& .MuiInputLabel-shrink': { fontSize: '0.82rem', fontWeight: 600 },
                      }}
                      InputProps={{ sx: { color: '#fff' } }}
                      InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.78)' } }}
                    />
                    <TextField
                      inputRef={fInputRef}
                      value={f}
                      onChange={(e) => setF(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={handleFKeyDown}
                      onFocus={handleFocus}
                      onPaste={(e) => { e.preventDefault(); const text = (e.clipboardData || window.clipboardData).getData('text') || ''; setF(text.replace(/\D/g, '').slice(0, 10)); }}
                      label="F"
                      variant="outlined"
                      size="medium"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 }}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderRadius: 2,
                          minHeight: 42,
                          height: 42,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
                          '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                        },
                        '& .MuiInputBase-input': { fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)', fontSize: '0.95rem', fontWeight: 500 },
                        '& .MuiInputLabel-shrink': { fontSize: '0.82rem', fontWeight: 600 },
                      }}
                      InputProps={{ sx: { color: '#fff' } }}
                      InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.78)' } }}
                    />
                    <TextField
                      inputRef={sInputRef}
                      value={s}
                      onChange={(e) => setS(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={handleSKeyDown}
                      onFocus={handleFocus2}
                      onPaste={(e) => { e.preventDefault(); const text = (e.clipboardData || window.clipboardData).getData('text') || ''; setS(text.replace(/\D/g, '').slice(0, 10)); }}
                      label="S"
                      variant="outlined"
                      size="medium"
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 }}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderRadius: 1,
                          minHeight: 42,
                          height: 42,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.14)' },
                          '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                        },
                        '& .MuiInputBase-input': { fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)', fontSize: '0.95rem', fontWeight: 500 },
                        '& .MuiInputLabel-shrink': { fontSize: '0.82rem', fontWeight: 600 },
                      }}
                      InputProps={{ sx: { color: '#fff' } }}
                      InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.78)' } }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'space-between', md: 'flex-end' }, gap: { xs: 1, md: 0.9 }, width: { xs: '100%', md: 'auto' }, minWidth: { md: 176 }, maxWidth: '100%', flexShrink: 1, pl: { md: 1 }, borderLeft: { md: '1px solid rgba(255,255,255,0.08)' } }}>
                    <FormControlLabel
                      control={<Switch checked={autoMode} onChange={toggleAutoMode} color="primary" />}
                      label="Auto Mode"
                      sx={{ mr: 0, ml: 0, maxWidth: '100%', '& .MuiSwitch-root': { mr: 0 }, '& .MuiFormControlLabel-label': { fontSize: { xs: 13, md: 13.5 }, fontWeight: 600, color: '#F3F4F6', lineHeight: 1, whiteSpace: 'nowrap' } }}
                    />
                    <Button type="submit" variant="contained" color="success" disabled={isPastClosingTime()} sx={{ fontSize: 14, fontWeight: 700, px: 1.8, height: 42, minWidth: 80 }}>
                      Save
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}

          </Paper>
        </Box>

        <Box sx={{ width: { xs: '100%', lg: 260 }, flexShrink: 0 }}>
          <div className="bg-gray-800 border border-gray-700 px-2 py-2 rounded-lg shadow-md text-white">
            <div className="flex flex-col gap-2">
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handlePaltiAKR}><FaStar /> <FaStar /> <span>Palti AKR</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handlePaltiTandula}><FaStar /> <FaStar /> <FaStar />  <span>Palti Tandula</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handleChakriRing}><FaStar /> <FaStar /> <FaStar /> <span>24 tandola</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handle3FigureRingWithX}><FaStar /> <FaStar /> <FaStar /> <span>12 tandulla</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handle4FigurePacket}><FaStar /> <FaStar />   <FaStar /> <FaStar />   <span>Pangora palti</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handleAKR2Figure}><span>AKR 6 jaga</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500" onClick={handleAKR2Figure3Jaga}><span>F+M+B AKR</span></button>
              <button className="w-full flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 text  -white rounded hover:bg-blue-500" onClick={handleRingPlusAKR}><span>Ring + AKR</span></button>
            </div>
          </div>
        </Box>
      </Box>

      {/* Bottom Section */}
        {userData && (
        <div className="mt-6">


      

      

      <Dialog
        open={deleteDialogOpen}
        onClose={() => { if (!isDeleting) setDeleteDialogOpen(false); }}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteDialogMode === 'single' ? 'Do you want to delete this record?' : `Do you want to delete ${selectedEntries.length} selected records?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button onClick={performDelete} color="error" variant="contained" disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete'}</Button>
        </DialogActions>
      </Dialog>

      {showModal && (
        <div className="fixed inset-0  bg-opacity-50 flex items-center justify-center" style={{ zIndex: 1300 }}>
          <div className="bg-white p-6 rounded shadow-lg w-96" style={{ zIndex: 1301 }}>
            <h2 className="text-xl text-black font-bold mb-4">Paste SMS</h2>

            <textarea
              className="w-full border text-black rounded p-2 h-24 mb-4"
              placeholder="Paste SMS here"
              value={smsInput}
              onChange={(e) => setSmsInput(e.target.value)}
            ></textarea>

            <button
              onClick={() => {
                const next = parseSMS(smsInput);
                setParsedEntries(next);
                if (!next.length) toast.error("Unable to parse SMS. Please check format.");
                else toast.success(`${next.length} entries parsed`);
              }}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 mb-3"
            >
              Preview
            </button>

            {parsedEntries.length > 0 && (
              <div className="border rounded mb-3 max-h-40 overflow-y-auto">
                <table className="w-full text-black text-sm border-collapse">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border px-2 py-1">NO</th>
                      <th className="border px-2 py-1">F</th>
                      <th className="border px-2 py-1">S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedEntries.map((entry, index) => (
                      <tr key={index}>
                        <td className="border px-2 py-1">{entry.no}</td>
                        <td className="border px-2 py-1">{entry.f}</td>
                        <td className="border px-2 py-1">{entry.s}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              {/* Cancel Button */}
              <button
                onClick={closeSmsModal} // Closes and resets modal
                className="bg-gray-400 text-black px-3 py-1 rounded hover:bg-gray-500"
              >
                Cancel
              </button>

              {/* Confirm Button (only if entries parsed) */}

              <button
                onClick={() => {
                  handleConfirmPaste(); // Adds entries (already checks draw time)
                  // closeSmsModal();      // Reset modal after confirm
                }}
                className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600"
              >
                Confirm
              </button>

            </div>

          </div>
        </div>
      )}

       
        </div>

        
      )}
      
    </div>
   
  


  );
}





export default Center;
