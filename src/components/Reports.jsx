import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { useSelector } from 'react-redux';
// import { toast } from 'react-toastify';
import toast from 'react-hot-toast';

const Reports = () => {
  const ALL_CLOSED_DRAWS = '__ALL_CLOSED_DRAWS__';
  const userData = useSelector((state) => state.user);
  const role = userData?.user?.role;
  const currentUserId = userData?.user?._id;

  const [draws, setDraws] = useState([]);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [drawDate, setDrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [drawTime] = useState('11 AM');
  const [selectedClient, setSelectedClient] = useState('');
  const [clients, setClients] = useState([]);
  const [ledger, setLedger] = useState('LEDGER');
  const [prizeType, setPrizeType] = useState('All');
  const [winningNumbers, setWinningNumbers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dailyBillAllClosed, setDailyBillAllClosed] = useState(false);

  const toLocalISODate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeSlotLabel = (slot) => {
    if (!slot) return '';
    if (slot.title && typeof slot.title === 'string') return slot.title;
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

  const getWinningNumbers = async (date) => {
    try {
      const params = {};
      const safeISODate = (d) => {
        try {
          if (!d) return '';
          const dt = typeof d === 'string' ? new Date(d) : new Date(d);
          if (Number.isNaN(dt.getTime())) return '';
          return dt.toISOString().split('T')[0];
        } catch (e) {
          return '';
        }
      };

      if (selectedDraw && selectedDraw.draw_date) params.date = safeISODate(selectedDraw.draw_date);
      else params.date = safeISODate(date) || date;
      if (selectedDraw && selectedDraw._id) params.timeSlotId = selectedDraw._id;

      const response = await axios.get('/api/v1/data/get-winning-numbers', {
        params,
      });

      if (response.data && response.data.winningNumbers) {
        const formattedNumbers = response.data.winningNumbers.map((item) => ({
          number: item.number,
          type: item.type,
          color: item.type === 'first' ? [255, 0, 0] : item.type === 'second' ? [0, 0, 255] : [128, 0, 128],
        }));
        setWinningNumbers(formattedNumbers);
        return formattedNumbers;
      }
      setWinningNumbers([]);
      return [];
    } catch (err) {
      setWinningNumbers([]);
      return [];
    }
  };

  const getEntryColor = (entryNumber) => {
    for (const winning of winningNumbers) {
      if (entryNumber === winning.number || checkPositionalMatch(entryNumber, winning.number)) return winning.color;
    }
    return [0, 0, 0];
  };

  const selectedClientName = (clients.find(c => String(c._id) === String(selectedClient))?.username) || userData?.user?.username || '';

  const fetchTimeSlots = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/timeslots');
      const slots = res.data?.timeSlots || res.data || [];
      const list = Array.isArray(slots) ? slots : [];
      setDraws(list);
      setSelectedDraw((prev) => {
        if (!prev || !prev._id) return prev;
        const refreshed = list.find((s) => String(s._id) === String(prev._id));
        return refreshed || null;
      });
    } catch (err) {
      setDraws([]);
    }
  }, []);

  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots, userData]);

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

  useEffect(() => {
    const fetchClients = async () => {
      if (role === 'user') return;
      try {
        const res = await axios.get('/api/v1/users/distributor-users');
        setClients(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setClients([]);
      }
    };
    fetchClients();
  }, [role, userData]);

  useEffect(() => {
    if (selectedDraw && selectedDraw.draw_date) {
      const iso = toLocalISODate(selectedDraw.draw_date);
      setDrawDate(iso);
    }
  }, [selectedDraw]);

  useEffect(() => {
    if (drawDate) getWinningNumbers(drawDate);
  }, [drawDate, selectedDraw]);

  useEffect(() => {
    if (ledger !== 'DAILY BILL') return;
    if (!dailyBillAllClosed && !selectedDraw) return;
    (async () => {
      try {
        const result = await buildDailyBillResult(drawDate, drawTime);
        setDailyBill(result || null);
      } catch (err) {
        setDailyBill(null);
      }
    })();
  }, [ledger, drawDate, selectedDraw, selectedClient, dailyBillAllClosed]);

  // Helper to build daily bill result without mutating component state
  const buildDailyBillResult = async (dateParam = drawDate) => {
    const selectedClientConfig = clients.find(c => String(c._id) === String(selectedClient));
    const baseConfig = role === 'user' ? userData?.user : (selectedClientConfig || userData?.user || {});
    const hissaShare = (Number(baseConfig.commission ?? 0) || 0) / 100;
    const multipliers = {
      HINSA: Number(baseConfig.hinsaMultiplier ?? 0) || 0,
      AKRA: Number(baseConfig.akraMultiplier ?? 0) || 0,
      TANDOLA: Number(baseConfig.tandolaMultiplier ?? 0) || 0,
      PANGORA: Number(baseConfig.pangoraMultiplier ?? 0) || 0,
    };
    const rates = {
      HINSA: Number(baseConfig.singleFigure || 0),
      AKRA: Number(baseConfig.doubleFigure || 0),
      TANDOLA: Number(baseConfig.tripleFigure || 0),
      PANGORA: Number(baseConfig.fourFigure || 0),
    };

    const toISODate = (d) => toLocalISODate(d);
    const isDrawClosedLocal = (d) => {
      if (!d) return false;
      if (typeof d.isActive === 'boolean') return d.isActive === false;
      if (typeof d.isExpired === 'boolean') return d.isExpired === true;
      if (d.draw_date) {
        const dt = new Date(d.draw_date);
        dt.setHours(23, 59, 59, 999);
        return Date.now() > dt.getTime();
      }
      return false;
    };
    const categorize = (num) => {
      if (/^\d{1}$/.test(num) || (num.includes('+') && num.length === 2) || (num.split('+').length - 1 === 2 && num.length === 3) || (num.split('+').length - 1 === 3 && num.length === 4)) return 'HINSA';
      if (/^\d{2}$/.test(num) || (num.includes('+') && num.length <= 3) || (num.split('+').length - 1 === 2 && num.length === 4)) return 'AKRA';
      if (/^\d{3}$/.test(num) || (num.length === 4 && num.includes('+'))) return 'TANDOLA';
      if (/^\d{4}$/.test(num)) return 'PANGORA';
      return 'OTHER';
    };

    const fetchWinningNumbersForDraw = async (dateValue, draw) => {
      try {
        const params = { date: toISODate(dateValue) || dateValue };
        if (draw && draw._id) params.timeSlotId = draw._id;
        const response = await axios.get('/api/v1/data/get-winning-numbers', { params });
        const list = Array.isArray(response.data?.winningNumbers) ? response.data.winningNumbers : [];
        return list.map((item) => ({ number: String(item.number || ''), type: item.type }));
      } catch (e) {
        return [];
      }
    };

    let targetDraws = [];
    if (dailyBillAllClosed) {
      const dateISO = toISODate(dateParam) || dateParam;
      targetDraws = (draws || [])
        .filter((d) => {
          if (!isDrawClosedLocal(d)) return false;
          // Some closed slots may not carry draw_date reliably; include them in all-closed mode.
          if (!d?.draw_date) return true;
          return toISODate(d.draw_date) === dateISO;
        })
        .sort((a, b) => Number(a.hour ?? 0) - Number(b.hour ?? 0));
      if (targetDraws.length === 0) return null;
    } else {
      if (!selectedDraw || !selectedDraw._id) return null;
      targetDraws = [selectedDraw];
    }

    const result = {
      drawRows: [],
      totals: { first: 0, second: 0, sale: 0, prize: 0, commission: 0, safi: 0, hissa: 0, subTotal: 0, bill: 0 },
      meta: {
        commissionLabel: `${rates.HINSA}%-${rates.AKRA}%-${rates.TANDOLA}%-${rates.PANGORA}%`,
        hissaPercent: (hissaShare * 100),
      },
    };

    const secondPrizeDivisor = 3;

    for (const draw of targetDraws) {
      const fetchedEntries = await fetchVoucherData(dateParam, null, null, false, draw?._id);
      let allRows = [];
      fetchedEntries.forEach(e => { if (Array.isArray(e.data)) allRows.push(...e.data); });
      if (allRows.length === 0) {
        result.drawRows.push({
          drawId: draw._id,
          drawName: formatTimeSlotLabel(draw),
          first: 0, second: 0, sale: 0, prize: 0, commission: 0, safi: 0, hissa: 0, subTotal: 0,
        });
        continue;
      }

      const rowsByCategory = { HINSA: [], AKRA: [], TANDOLA: [], PANGORA: [] };
      allRows.forEach(r => {
        const num = String(r.uniqueId || r.number || r.no || '');
        const first = Number(r.firstPrice ?? r.f ?? 0) || 0;
        const second = Number(r.secondPrice ?? r.s ?? 0) || 0;
        const cat = categorize(num);
        if (cat in rowsByCategory) rowsByCategory[cat].push([num, first, second]);
      });

      const winningNumbersForDraw = await fetchWinningNumbersForDraw(dateParam, draw);
      let firstSale = 0;
      let secondSale = 0;
      let prize = 0;
      let commission = 0;

      Object.entries(rowsByCategory).forEach(([cat, rows]) => {
        const catFirst = rows.reduce((acc, [, f]) => acc + (Number(f) || 0), 0);
        const catSecond = rows.reduce((acc, [, , s]) => acc + (Number(s) || 0), 0);
        const catSale = catFirst + catSecond;
        firstSale += catFirst;
        secondSale += catSecond;
        commission += (catSale * (Number(rates[cat]) || 0)) / 100;

        const multiplier = Number(multipliers[cat]) || 1;
        rows.forEach(([num, f, s]) => {
          for (const winning of winningNumbersForDraw) {
            if (num === winning.number || checkPositionalMatch(num, winning.number)) {
              if (winning.type === 'first') prize += (Number(f) || 0) * multiplier;
              else if (winning.type === 'second' || winning.type === 'third') prize += ((Number(s) || 0) * multiplier) / secondPrizeDivisor;
            }
          }
        });
      });

      const sale = firstSale + secondSale;
      const safi = sale - commission;
      const subTotal = safi - prize;
      const hissa = Math.max(0, prize - safi) * hissaShare;

      result.drawRows.push({
        drawId: draw._id,
        drawName: formatTimeSlotLabel(draw),
        first: firstSale,
        second: secondSale,
        sale,
        prize,
        commission,
        safi,
        hissa,
        subTotal,
      });

      result.totals.first += firstSale;
      result.totals.second += secondSale;
      result.totals.sale += sale;
      result.totals.prize += prize;
      result.totals.commission += commission;
      result.totals.subTotal += subTotal;
      result.totals.hissa += hissa;
    }

    result.totals.safi = result.totals.sale - result.totals.commission;
    result.totals.hissa = Math.max(0, result.totals.prize - result.totals.safi) * hissaShare;
    result.totals.subTotal = result.totals.safi - result.totals.prize;
    result.totals.bill = result.totals.subTotal - result.totals.hissa;

    return result.drawRows.length > 0 ? result : null;
  };
  // Numeric helpers: avoid floating point drift and format consistently
  const toCents = (v) => Math.round((Number(v) || 0) * 100);
  const fromCents = (c) => (Number(c || 0) / 100);
  const formatCurrency = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0.00';
    return (Math.round(n * 100) / 100).toFixed(2);
  };

  const checkPositionalMatch = (entry, winningNumber) => {
    // Remove any spaces and ensure consistent format
    const cleanEntry = entry.toString().trim();

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

  const getAndSetVoucherData = async () => {  // use in to fetch data base on time/date
      const fetchedData = await fetchVoucherData(drawDate, drawTime);
  
      if (Array.isArray(fetchedData) && fetchedData.length > 0) {
        const filteredRecords = fetchedData.filter((record) => {
          const recordDate = new Date(record.date).toISOString().split("T")[0];
          const selectedDateISO = new Date(drawDate).toISOString().split("T")[0];
          return (
            recordDate === selectedDateISO &&
            record.timeSlot === drawTime
          );
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
  
        setEntries(combinedEntries);
        console.log("combined entires", combinedEntries);  // jo bhi entries hongi wo yengi
  
  
      } else {
        setEntries([]);
      }
  };

  const fetchVoucherData = async (selectedDate, selectedTimeSlot, explicitUserId = null, requireClosed = false, explicitTimeSlotId = null) => {
      // If current user is not a regular user, require selecting a client (unless explicitUserId provided)
      if (role !== 'user' && !selectedClient && !explicitUserId) {
        toast('Please select a client');
        return [];
      }
      setLoading(true);
      try {
        const params = {};
        // Use explicitUserId when provided; otherwise resolve from role/selectedClient
        params.userId = explicitUserId || (role === 'user' ? currentUserId : selectedClient);
        // Always include a date parameter (backend requires date + userId)
        params.date = selectedDate || drawDate;
        // Prefer timeSlotId when available
        if (explicitTimeSlotId) params.timeSlotId = explicitTimeSlotId;
        else if (selectedDraw && selectedDraw._id) params.timeSlotId = selectedDraw._id;
        else if (selectedTimeSlot) params.timeSlot = selectedTimeSlot;
        if (requireClosed) params.requireClosed = true;
        const response = await axios.get("/api/v1/data/get-client-data", { params });
        return response.data.data || [];
      } catch (error) {
        toast.error((error.response?.data?.error) || 'Failed to fetch voucher data');
        return [];
      } finally {
        setLoading(false);
      }
  };

    const isSelectedDrawClosed = () => {
      if (selectedDraw) {
        if (typeof selectedDraw.isActive === 'boolean') return selectedDraw.isActive === false;
        if (typeof selectedDraw.isExpired === 'boolean') return selectedDraw.isExpired;
        if (selectedDraw.draw_date) { const d = new Date(selectedDraw.draw_date); d.setHours(23,59,59,999); return Date.now() > d.getTime(); }
        return false;
      }
      if (drawDate) { const d = new Date(drawDate); d.setHours(23,59,59,999); return Date.now() > d.getTime(); }
      return false;
    };

    const generateVoucherPDF = async ({ userId = null, date = null, timeSlotId = null, prizeTypeParam = 'All' } = {}) => {
      // Ensure draw is closed before generating voucher
      if (!isSelectedDrawClosed()) { toast.error('Draw is not close yet'); return; }
      // prefer explicit args, otherwise use current selection
      const fetchDate = date || drawDate;
      const fetchTimeSlot = timeSlotId || (selectedDraw && selectedDraw._id ? selectedDraw._id : drawTime);
      const fetchedEntries = await fetchVoucherData(fetchDate, fetchTimeSlot, userId, true);
      if (fetchedEntries.length === 0) {
        toast("No Record found..");
        return;
      }
    
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
    
      // Get all voucher rows and categorize them
      const allVoucherRows = (selectedDraw && selectedDraw._id)
        ? fetchedEntries.flatMap(entry => entry.data.map(item => ({ number: item.uniqueId, first: item.firstPrice, second: item.secondPrice })))
        : fetchedEntries
            .filter(entry => entry.timeSlot === drawTime)
            .flatMap(entry => entry.data.map(item => ({ number: item.uniqueId, first: item.firstPrice, second: item.secondPrice })));
    
      // Split entries into categories (same logic as in generateLedgerPDF)
      const hinsa = [], akra = [], tandola = [], pangora = [];
    
      allVoucherRows.forEach(({ number, first, second }) => {
        if (/^\d{1}$/.test(number) ||
          (number.includes('+') && number.length === 2) || 
          (number.split('+').length - 1 === 2 && number.length === 3) || 
          (number.split('+').length - 1 === 3 && number.length === 4)
        ) {
          // Single digit numbers go to hinsa
          if (prizeTypeParam === 'All' || prizeTypeParam === 'Hinsa') hinsa.push([number, first, second]);
        } else if (
          /^\d{2}$/.test(number) ||
          (number.includes('+') && number.length <= 3) ||
          (number.split('+').length - 1 === 2 && number.length === 4)
        ) {
          if (prizeTypeParam === 'All' || prizeTypeParam === 'Akra') akra.push([number, first, second]);
        } else if (
          /^\d{3}$/.test(number) ||
          (number.length === 4 && number.includes('+'))
        ) {
          if (prizeTypeParam === 'All' || prizeTypeParam === 'Tandola') tandola.push([number, first, second]);
        } else if (/^\d{4}$/.test(number)) {
          if (prizeTypeParam === 'All' || prizeTypeParam === 'Pangora') pangora.push([number, first, second]);
        }
      });
    
      const totalEntries = allVoucherRows.length;

      // Resolve base user/client configuration for commission & multipliers
      const clientIdToUse = userId || selectedClient;
      let fetchedClientConfig = null;
      if (role !== 'user' && clientIdToUse) {
        // try to find in loaded clients list first
        fetchedClientConfig = clients.find(c => String(c._id) === String(clientIdToUse));
        if (!fetchedClientConfig) {
        try {
          const resp = await axios.get(`/api/v1/users/${clientIdToUse}`);
          // API may return the user object directly or wrapped (resp.data.user / resp.data.data)
          fetchedClientConfig = resp.data?.user || resp.data?.data || resp.data || null;
        } catch (err) {
          // ignore and fall back to logged-in user's config
          fetchedClientConfig = null;
        }
        }
      }
      const baseUserConfig = role === 'user' ? userData?.user : (fetchedClientConfig || userData?.user || {});
    
      // Calculate totals for each section (work in cents to avoid FP drift)
      const calculateSectionTotals = (rows) => {
        return rows.reduce(
          (acc, row) => {
            acc.firstTotalCents += toCents(row[1]);
            acc.secondTotalCents += toCents(row[2]);
            return acc;
          },
          { firstTotalCents: 0, secondTotalCents: 0 }
        );
      };
    
      const hinsaTotals = calculateSectionTotals(hinsa);
      const akraTotals = calculateSectionTotals(akra);
      const tandolaTotals = calculateSectionTotals(tandola);
      const pangoraTotals = calculateSectionTotals(pangora);

      // Track grand totals including commission and net (store in cents)
      const grandTotals = {
        firstTotalCents: hinsaTotals.firstTotalCents + akraTotals.firstTotalCents + tandolaTotals.firstTotalCents + pangoraTotals.firstTotalCents,
        secondTotalCents: hinsaTotals.secondTotalCents + akraTotals.secondTotalCents + tandolaTotals.secondTotalCents + pangoraTotals.secondTotalCents,
        commissionCents: 0,
        netCents: 0,
      };
      const grandTotalCents = grandTotals.firstTotalCents + grandTotals.secondTotalCents;
    
    const drawHeaderLabel = selectedDraw ? `${formatTimeSlotLabel(selectedDraw)}${selectedDraw.isActive === false ? ' (Closed)' : selectedDraw.isActive === true ? ' (Active)' : ''}` : `${drawDate} ${drawTime}`;

    const addHeader = (titleLabel = 'Voucher') => {
        doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
    // Title
    doc.text(titleLabel, pageWidth / 2, 15, { align: "center" });
    
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
      // Resolve a readable dealer/client name for the header
      const selectedClientName = (clients.find(c => String(c._id) === String(userId || selectedClient))?.username) || (userData?.user && String(userData.user._id) === String(userId) ? userData?.user.username : userData?.user.username);
      doc.text(`Dealer Name: ${selectedClientName}`, 14, 30);
    doc.text(`City: ${userData?.user.city}`, 14, 40);
    doc.text(`Draw: ${drawHeaderLabel}`, 14, 50);
        // doc.text(`Total Entries: ${totalEntries}`, 14, 70);
    
        // Grand totals will be printed after sections are rendered (to ensure correct aggregation)
      };
    
      // helper for voucher table cell amounts: show integers only (e.g., 100)
      const formatVoucherCellAmount = (value) => {
        const num = Number(value) || 0;
        return Math.round(num).toString();
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
        const sectionTotalCents = sectionTotals.firstTotalCents + sectionTotals.secondTotalCents;
        const sectionTotal = fromCents(sectionTotalCents);

        // determine commission rate per section from resolved `baseUserConfig`
        let commissionRate = 0;
        if (title === 'HINSA') commissionRate = baseUserConfig?.singleFigure || 0;
        else if (title === 'AKRA') commissionRate = baseUserConfig?.doubleFigure || 0;
        else if (title === 'TANDOLA') commissionRate = baseUserConfig?.tripleFigure || 0;
        else if (title === 'PANGORA') commissionRate = baseUserConfig?.fourFigure || 0;

        // compute commission/net in cents to avoid FP issues
        const commissionAmountCents = Math.round(sectionTotalCents * (Number(commissionRate) || 0) / 100);
        const netAfterCommissionCents = sectionTotalCents - commissionAmountCents;

        // accumulate into grand totals (cents)
        grandTotals.commissionCents += commissionAmountCents;
        grandTotals.netCents += netAfterCommissionCents;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`First: ${formatCurrency(fromCents(sectionTotals.firstTotalCents))}`, 14, y);
        doc.text(`Second: ${formatCurrency(fromCents(sectionTotals.secondTotalCents))}`, 60, y);
        doc.text(`Total: ${formatCurrency(sectionTotal)}`, 106, y);
        doc.text(`Commission (${commissionRate}%): ${formatCurrency(fromCents(commissionAmountCents))}`, 140, y);
        y += 5;
        doc.text(`Net: ${formatCurrency(fromCents(netAfterCommissionCents))}`, 14, y);
        y += 2;

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
            doc.text(formatVoucherCellAmount(f), leftX + colWidths[0] + 1, currentY + 5);
            doc.rect(leftX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
            doc.text(formatVoucherCellAmount(s), leftX + colWidths[0] + colWidths[1] + 1, currentY + 5);
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
            doc.text(formatVoucherCellAmount(f), middleX + colWidths[0] + 1, currentY + 5);
            doc.rect(middleX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
            doc.text(formatVoucherCellAmount(s), middleX + colWidths[0] + colWidths[1] + 1, currentY + 5);
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
            doc.text(formatVoucherCellAmount(f), rightX + colWidths[0] + 1, currentY + 5);
            doc.rect(rightX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
            doc.text(formatVoucherCellAmount(s), rightX + colWidths[0] + colWidths[1] + 1, currentY + 5);
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
      // After rendering all sections, print grand totals, commission and net totals
      try {
        let baseY = nextY + 5; // place summary just below the last section

        // If we're too close to the bottom, move summary to a new page under the header
        if (baseY > pageHeight - 70) {
          doc.addPage();
          addHeader();
          baseY = 70; // below header text on the new page
        }

        // Draw heading and a separator line across the page
        doc.setDrawColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Summary sale voucher", 14, baseY - 2);
        doc.line(14, baseY, pageWidth - 14, baseY);

        const tableX = pageWidth - 90; // small table on the right side
        let tableY = baseY + 4;
        const rowHeight = 7;
        const colWidths = [45, 35]; // Label, Value

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const firstTotal = fromCents(grandTotals.firstTotalCents || 0);
        const secondTotal = fromCents(grandTotals.secondTotalCents || 0);
        const grandTotal = (firstTotal || 0) + (secondTotal || 0);
        const commissionTotal = fromCents(grandTotals.commissionCents || 0);
        const netTotal = fromCents(grandTotals.netCents || 0);

        const rows = [
          ["First Total", formatCurrency(firstTotal)],
          ["Second Total", formatCurrency(secondTotal)],
          ["Grand Total", formatCurrency(grandTotal)],
          ["Commission Total", formatCurrency(commissionTotal)],
          ["Net Total", formatCurrency(netTotal)],
        ];

        rows.forEach(([label, value]) => {
          // label cell
          doc.rect(tableX, tableY, colWidths[0], rowHeight);
          doc.text(label, tableX + 2, tableY + 5);
          // value cell
          doc.rect(tableX + colWidths[0], tableY, colWidths[1], rowHeight);
          doc.text(value, tableX + colWidths[0] + 2, tableY + 5);
          tableY += rowHeight;
        });
      } catch (e) {
        // ignore
      }

      doc.save("Voucher_Sheet_by_Sections_RLC.pdf");
      toast.success("Voucher PDF by sections downloaded successfully!");
  };

  const generateLedgerPDF = async () => {
  
      const fetchedEntries = await fetchVoucherData(drawDate, drawTime);
      if (fetchedEntries.length === 0) {
        toast("No Record found..");
        return;
      }
  
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.width;
  
      const allVoucherRows = (selectedDraw && selectedDraw._id)
        ? fetchedEntries.flatMap(entry => entry.data.map(item => ({ number: item.uniqueId, first: item.firstPrice, second: item.secondPrice })))
        : fetchedEntries
            .filter(entry => entry.timeSlot === drawTime)
            .flatMap(entry => entry.data.map(item => ({ number: item.uniqueId, first: item.firstPrice, second: item.secondPrice })));
  
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
  
      const drawHeaderLabel = selectedDraw ? `${formatTimeSlotLabel(selectedDraw)}${selectedDraw.isActive === false ? ' (Closed)' : selectedDraw.isActive === true ? ' (Active)' : ''}` : `${drawDate} ${drawTime}`;

      const addHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        const titleSuffix = prizeType && prizeType !== 'All' ? ` (${prizeType})` : "";
        doc.text(`Ledger Sheet${titleSuffix}`, pageWidth / 2, 15, { align: "center" });

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Dealer Name: ${selectedClientName}`, 14, 30);
        doc.text(`City: ${userData?.user.city}`, 14, 40);
        doc.text(`Draw: ${drawHeaderLabel}`, 14, 50);
        doc.text(`Winning Numbers: `, 14, 60);
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
  
      const updateWinningNumbers = (newWinningNumbers) => {
        setWinningNumbers(newWinningNumbers);
      };
  
      const grandTotals = {
        first: 0,
        second: 0,
        net: 0,
        commission: 0,
        payable: 0,
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

        // For reports: use the selected client's configuration when
        // distributor is generating a client ledger; otherwise fall
        // back to the logged-in user's config.
        const selectedClientConfig = clients.find(
          (c) => String(c._id) === String(selectedClient)
        );
        const baseUserConfig = role === 'user' ? userData?.user : (selectedClientConfig || userData?.user || {});

        if (title === "HINSA") {
          commissionRate = baseUserConfig.singleFigure;
          multiplier = Number(baseUserConfig.hinsaMultiplier ?? 0) || 0;
        } else if (title === "AKRA") {
          commissionRate = baseUserConfig.doubleFigure;
          multiplier = Number(baseUserConfig.akraMultiplier ?? 0) || 0;
        } else if (title === "TANDOLA") {
          commissionRate = baseUserConfig.tripleFigure;
          multiplier = Number(baseUserConfig.tandolaMultiplier ?? 0) || 0;
        } else if (title === "PANGORA") {
          commissionRate = baseUserConfig.fourFigure;
          multiplier = Number(baseUserConfig.pangoraMultiplier ?? 0) || 0;
        }
  
        // const commissionAmount = net * commissionRate;
        // const netPayable = net - commissionAmount;
  
        // Calculate winning amounts for this section
        let firstWinningAmount = 0;
        let secondWinningAmount = 0;
        const secondPrizeDivisor = 3;
  
        rows.forEach(([num, f, s]) => {
          const entryColor = getEntryColor(num);
  
          // Check if this entry is highlighted (has winning color)
          if (entryColor[0] !== 0 || entryColor[1] !== 0 || entryColor[2] !== 0) {
            // Sum over ALL distinct winning numbers that match this entry,
            // so one entry (e.g. "12") can win for 129050 AND 122010.
            for (const winning of winningNumbers) {
              if (num === winning.number || checkPositionalMatch(num, winning.number)) {
                if (winning.type === "first") {
                  firstWinningAmount += f * multiplier;
                  // secondWinningAmount += s * multiplier;
                } else if (winning.type === "second" || winning.type === "third") {
                  // firstWinningAmount += (f * multiplier) / 3;
                  secondWinningAmount += (s * multiplier) / secondPrizeDivisor;
                }
              }
            }
          }
        });
  
        const totalWinningAmount = firstWinningAmount + secondWinningAmount;

        // compute commission for this section
        const commissionAmount = (net * (Number(commissionRate) || 0)) / 100;
        const netPayable = net - commissionAmount;

        grandTotals.first += totals.first;
        grandTotals.second += totals.second;
        grandTotals.net += net;
        grandTotals.commission += commissionAmount;
        grandTotals.payable += netPayable;
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
        doc.text(`First Total: ${formatCurrency(totals.first)}`, 14, y);
        doc.text(`Second Total: ${formatCurrency(totals.second)}`, 60, y);
        doc.text(`Total: ${formatCurrency(net)}`, 106, y);
        doc.text(`Commission (${commissionRate}%): ${formatCurrency(commissionAmount)}`, 140, y);
        y += 5;
        doc.text(`Net After Commission: ${formatCurrency(netPayable)}`, 14, y);
        y += 5;
        doc.text(`Prize Amount: ${formatCurrency(totalWinningAmount)}`, 14, y);
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
            // doc.text(title + " (continued...)", 14, 20);
  
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
            doc.text(formatCurrency(f), leftX + colWidths[0] + 1, currentY + 5);
            doc.rect(leftX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
            doc.text(formatCurrency(s), leftX + colWidths[0] + colWidths[1] + 1, currentY + 5);
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
            doc.text(formatCurrency(f), middleX + colWidths[0] + 1, currentY + 5);
            doc.rect(middleX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
            doc.text(formatCurrency(s), middleX + colWidths[0] + colWidths[1] + 1, currentY + 5);
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
            doc.text(formatCurrency(f), rightX + colWidths[0] + 1, currentY + 5);
            doc.rect(rightX + colWidths[0] + colWidths[1], currentY, colWidths[2], rowHeight);
            doc.text(formatCurrency(s), rightX + colWidths[0] + colWidths[1] + 1, currentY + 5);
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
        y += rowHeight;
        drawRow(y, "Commission Total", -grandTotals.commission, 0, -grandTotals.commission);
        y += rowHeight;
        drawRow(y, "Net Payable", grandTotals.payable, 0, grandTotals.payable);
        y += rowHeight;
        drawRow(y, "Winning Amount", grandTotals.firstWinning, grandTotals.secondWinning, grandTotals.winningAmount);
      };
  
      addHeader();
      let nextY = 80;

      // Render only the sections matching the selected Prize Type.
      // Grand totals are also based only on rendered sections.
      if (prizeType === "All" || prizeType === "Hinsa") {
        nextY = renderSection("HINSA", hinsa, nextY);
      }
      if (prizeType === "All" || prizeType === "Akra") {
        nextY = renderSection("AKRA", akra, nextY);
      }
      if (prizeType === "All" || prizeType === "Tandola") {
        nextY = renderSection("TANDOLA", tandola, nextY);
      }
      if (prizeType === "All" || prizeType === "Pangora") {
        nextY = renderSection("PANGORA", pangora, nextY);
      }
      renderGrandTotals(nextY);
  
      doc.save("Ledger_Sheet_RLC.pdf");
      toast.success("Ledger PDF downloaded successfully!");
  };

  const generateDailyBillPDF = async () => {
      const result = await buildDailyBillResult(drawDate, drawTime);
      if (!result) {
        toast('No record found for the selected date.');
        return;
      }

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const x = 14;
      const right = pageWidth - 14;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Daily Bill", pageWidth / 2, 14, { align: "center" });

      const dealerName = (clients.find(c => String(c._id) === String(selectedClient))?.username) || userData?.user?.username || '';
      const dealerId = (clients.find(c => String(c._id) === String(selectedClient))?.dealerId) || userData?.user?.dealerId || '';

      let y = 24;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Dealer ID: ${dealerId}`, x, y);
      doc.text(`Date: ${drawDate}`, x + 62, y);
      doc.text(`Commission: ${result.meta?.commissionLabel || ''}`, x + 110, y);
      y += 7;
      doc.text(`Dealer Name: ${dealerName}`, x, y);
      doc.text(`City: ${userData?.user?.city || ''}`, x + 62, y);
      doc.text(`Profit/Loss Share: ${formatCurrency(result.meta?.hissaPercent || 0)}%`, x + 110, y);
      y += 8;

      const rowHeight = 8;
      const colWidths = [80, 60, 40]; // Draw Name, Sale, Prize

      doc.setFont("helvetica", "bold");
      doc.rect(x, y, colWidths[0], rowHeight);
      doc.text("DRAW NAME", x + 2, y + 5.5);
      doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
      doc.text("SALE", x + colWidths[0] + 2, y + 5.5);
      doc.rect(x + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
      doc.text("PRIZE", x + colWidths[0] + colWidths[1] + 2, y + 5.5);
      y += rowHeight;

      doc.setFont("helvetica", "normal");
      for (const row of (result.drawRows || [])) {
        if (y > pageHeight - 45) {
          doc.addPage();
          y = 20;
        }
        doc.rect(x, y, colWidths[0], rowHeight);
        doc.text(String(row.drawName || ''), x + 2, y + 5.5);
        doc.rect(x + colWidths[0], y, colWidths[1], rowHeight);
        doc.text(formatCurrency(row.sale), x + colWidths[0] + 2, y + 5.5);
        doc.rect(x + colWidths[0] + colWidths[1], y, colWidths[2], rowHeight);
        doc.text(formatCurrency(row.prize), x + colWidths[0] + colWidths[1] + 2, y + 5.5);
        y += rowHeight;
      }

      y += 6;
      if (y > pageHeight - 55) {
        doc.addPage();
        y = 20;
      }

      const totals = result.totals || { sale: 0, safi: 0, prize: 0, subTotal: 0, commission: 0, hissa: 0, bill: 0 };
      doc.setFont("helvetica", "normal");
      doc.text(`SALE-TOTAL: ${formatCurrency(totals.sale)}`, x + 1, y); y += 7;
      doc.text(`SAFI-SALE: ${formatCurrency(totals.safi)}`, x + 1, y); y += 7;
      doc.text(`PRIZE: ${formatCurrency(totals.prize)}`, x + 1, y); y += 7;
      doc.text(`SUB TOTAL: ${formatCurrency(totals.subTotal)}`, x + 1, y); y += 7;
      doc.text(`COMMISSION: ${formatCurrency(totals.commission)}`, x + 1, y); y += 7;
      doc.text(`PROFIT/LOSS SHARE: ${formatCurrency(totals.hissa)}`, x + 1, y); y += 10;

      doc.setFont("helvetica", "bold");
      doc.rect(x, y - 5, right - x, 9);
      doc.text(`Bill: ${formatCurrency(totals.bill)}`, x + 2, y + 1.5);

      doc.save("Daily_Bill_RLC.pdf");
      toast.success("Daily Bill PDF downloaded successfully!");
  };

  // Compute daily bill values and keep in state for UI display
  const [dailyBill, setDailyBill] = useState(null);

  const computeDailyBill = async () => {
    const result = await buildDailyBillResult(drawDate, drawTime);
    if (!result) {
      toast('No records found for selected date');
      setDailyBill(null);
      return;
    }
    setDailyBill(result);
  };

  // PDF export (simple)
  const handleDownloadPDF = async () => {
      // Prevent PDF generation while selected draw is still open
      // if (selectedDraw && drawRemainingMs != null && drawRemainingMs > 0) {
      //   toast('Selected draw is still open. PDF generation is disabled until the draw is closed.');
      //   return;
      // }

      if (ledger === "VOUCHER") {
        await generateVoucherPDF({ userId: role === 'user' ? currentUserId : selectedClient, date: drawDate, timeSlotId: selectedDraw?._id, prizeTypeParam: prizeType });
      }
      else if (ledger === "LEDGER") {
        await generateLedgerPDF();
      }
      else if (ledger === "DAILY BILL") {
        await generateDailyBillPDF();
      }
      
      else {
        toast.error("Please select a valid ledger type.");
  
      }
  };

  

  return (
    <div className="bg-gray-900 text-white p-4 md:p-6 rounded-xl max-w-6xl mx-auto w-full">
      <h2 className="text-2xl font-bold mb-4">Client Reports</h2>
      <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-4">
        <div className="min-w-[150px]">
          <label className="block mb-1">Date</label>
          <input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 w-full" />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="block mb-1">Select Time Slot</label>
          <select value={dailyBillAllClosed ? ALL_CLOSED_DRAWS : (selectedDraw?._id || "")} onChange={e => {
            const id = e.target.value;
            if (id === ALL_CLOSED_DRAWS) {
              setDailyBillAllClosed(true);
              setSelectedDraw(null);
              return;
            }
            setDailyBillAllClosed(false);
            const d = draws.find(x => String(x._id) === String(id)) || null;
            setSelectedDraw(d);
            if (d && d.draw_date) setDrawDate(toLocalISODate(d.draw_date));
          }} className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 w-full">
            <option value="">-- Select time slot --</option>
            {ledger === 'DAILY BILL' && <option value={ALL_CLOSED_DRAWS}>All Closed Draws</option>}
            {draws.map(d => (
              <option key={d._id} value={d._id}>{`${formatTimeSlotLabel(d)}${d.isActive === false ? ' (Closed)' : d.isActive === true ? ' (Active)' : ''}`}</option>
            ))}
          </select>
        </div>
        {/* Selected Draw info removed per request */}
        {/* Time selection removed: draw-level selection uses admin-managed draws now */}
        {role !== 'user' && (
          <div className="min-w-[160px]">
            <label className="block mb-1">Client</label>
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 w-full">
              <option value="">Select Client</option>
              {clients.map(client => (
                <option key={client._id} value={client._id}>{client.username}</option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-[140px]">
            <label className="block mb-1">Report</label>
            <select
                className="bg-gray-700 text-gray-100 px-3 py-2 rounded-lg border border-gray-600 w-full"
                value={ledger}
                onChange={(e) => setLedger(e.target.value)}
              >
              <option>LEDGER</option>
              <option>DAILY BILL</option>
              <option>VOUCHER</option>
            </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block mb-1">Prize Type</label>
          <select value={prizeType} onChange={(e) => setPrizeType(e.target.value)} className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 w-full">
            <option>All</option>
            <option>Hinsa</option>
            <option>Akra</option>
            <option>Tandola</option>
            <option>Pangora</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleDownloadPDF} className="bg-green-600 px-4 py-2 rounded whitespace-nowrap">Download</button>
        </div>
        <div className="flex items-end">
          {ledger === 'DAILY BILL' && (
            <button onClick={computeDailyBill} className="bg-blue-600 px-4 py-2 rounded whitespace-nowrap">Compute Daily Bill</button>
          )}
        </div>
      </div>
      {/* Daily Bill UI */}
      {ledger === 'DAILY BILL' && dailyBill && (
        <div className="mt-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Daily Bill Summary ({drawDate})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-300">
                  <th className="px-3 py-2">Draw Name</th>
                  <th className="px-3 py-2">Sale</th>
                  <th className="px-3 py-2">Prize</th>
                </tr>
              </thead>
              <tbody>
                {(dailyBill.drawRows || []).map((r) => (
                  <tr key={r.drawId || r.drawName} className="border-t border-gray-700">
                    <td className="px-3 py-2 font-semibold">{r.drawName}</td>
                    <td className="px-3 py-2">{formatCurrency(r.sale)}</td>
                    <td className="px-3 py-2">{formatCurrency(r.prize)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-600 font-semibold text-gray-200">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2">{formatCurrency(dailyBill.totals.sale)}</td>
                  <td className="px-3 py-2">{formatCurrency(dailyBill.totals.prize)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>Total Sale: <span className="font-semibold">{formatCurrency(dailyBill.totals.sale)}</span></div>
              <div>Safi Sale: <span className="font-semibold">{formatCurrency(dailyBill.totals.safi)}</span></div>
              <div>Prize: <span className="font-semibold">{formatCurrency(dailyBill.totals.prize)}</span></div>
              <div>Sub Total: <span className="font-semibold">{formatCurrency(dailyBill.totals.subTotal)}</span></div>
              <div>Commission: <span className="font-semibold">{formatCurrency(dailyBill.totals.commission)}</span></div>
              <div>Hissa: <span className="font-semibold">{formatCurrency(dailyBill.totals.hissa)}</span></div>
              <div>Bill: <span className="font-semibold">{formatCurrency(dailyBill.totals.bill)}</span></div>
            </div>
          </div>
        </div>
      )}
      {/* {loading ? <div>Loading...</div> : (
        <>
          <div className="bg-gray-800 rounded p-4">
            <h3 className="text-lg font-semibold mb-2">Entries</h3>
            {entries.length === 0 ? <div>No data found</div> : (
              <ul className="space-y-2">
                {entries.map((entry, idx) => (
                  <li key={entry.objectId || idx} className="border-b border-gray-700 pb-2">
                    <div className="font-bold">{idx + 1}. {entry.no}</div>
                    <div className="text-sm text-gray-300">F: {entry.f} &nbsp; S: {entry.s}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )} */}

      
    </div>
  );
};

export default Reports;
