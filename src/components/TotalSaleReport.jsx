import React, { useEffect, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import 'jspdf-autotable';

const TotalSaleReport = () => {
  const userData = useSelector((s) => s.user);
  const role = userData?.user?.role;
  const currentUserId = userData?.user?._id;
  const [draws, setDraws] = useState([]);
  const [selectedDraw, setSelectedDraw] = useState(null);
  const [drawDate, setDrawDate] = useState(new Date().toISOString().split('T')[0]);
  const [drawTime, setDrawTime] = useState('11 AM');
  const [prizeType, setPrizeType] = useState('All');
  // Single control: ledger will store category values 'general'|'demand'|'overlimit'
  const [ledger, setLedger] = useState('general');
  const [winningNumbers, setWinningNumbers] = useState([]);

  useEffect(() => {
    const fetchTimeSlots = async () => {
      try {
        const token = userData?.token || localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get('/api/v1/timeslots', { headers });
        const slots = res.data?.timeSlots || res.data || [];
        setDraws(slots);
        // default to first active slot if none selected
        if ((!selectedDraw || !selectedDraw._id) && Array.isArray(slots) && slots.length > 0) {
          const firstActive = slots.find(s => s.isActive === true) || slots[0];
          setSelectedDraw(firstActive || null);
        }
      } catch (err) {
        console.error('Failed to fetch timeslots', err);
        setDraws([]);
      }
    };
    fetchTimeSlots();
  }, [userData]);

  // Helper: format a timeslot object to 12-hour label (e.g. 13 -> "1PM" or label "13:00" -> "1PM")
  const formatTimeSlotLabel = (slot) => {
    if (!slot) return "";
    if (slot.title && typeof slot.title === 'string') return slot.title;
    const label = slot.label || (typeof slot.hour !== 'undefined' ? `${String(slot.hour).padStart(2,'0')}:00` : null);
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

  const fetchCombinedVoucherData = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (role === 'user' && currentUserId) params.userId = currentUserId;
      // Always include a date parameter so backend filters by date + timeslot/timeSlotId
      if (selectedDraw && selectedDraw.draw_date) params.date = (typeof selectedDraw.draw_date === 'string') ? selectedDraw.draw_date.split('T')[0] : new Date(selectedDraw.draw_date).toISOString().split('T')[0];
      else params.date = drawDate;
      if (selectedDraw && selectedDraw._id) params.timeSlotId = selectedDraw._id;
      else params.timeSlot = drawTime;
      // enforce server-side closed check for combined voucher generation
      params.requireClosed = true;

      // Call the backend combined endpoint which returns Data docs populated with user info
      const res = await axios.get('/api/v1/data/get-combined-voucher-data', {
        params,
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });
      return res.data.data || [];
    } catch (err) {
      console.error('Failed to fetch combined voucher data', err);
      toast.error('Failed to fetch combined voucher data');
      return [];
    }
  };

  const getWinningNumbers = async (date) => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      const safeISODate = (d) => { try { if (!d) return ''; const dt = typeof d === 'string' ? new Date(d) : new Date(d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch (e) { return ''; } };
      if (selectedDraw && selectedDraw.draw_date) params.date = safeISODate(selectedDraw.draw_date);
      else params.date = safeISODate(date) || date;
      const response = await axios.get('/api/v1/data/get-winning-numbers', { params, headers: { Authorization: token ? `Bearer ${token}` : undefined } });
      if (response.data && response.data.winningNumbers) {
        const formattedNumbers = response.data.winningNumbers.map((item) => ({
          number: item.number,
          type: item.type,
          color: item.type === 'first' ? [255, 0, 0] : item.type === 'second' ? [0, 0, 255] : [128, 0, 128],
        }));

        // Deduplicate by 6-digit number + type so the same
        // winning number entered twice does not change coloring
        // or any downstream prize calculations.
        const uniqueMap = new Map();
        formattedNumbers.forEach((w) => {
          const key = `${w.number}-${w.type}`;
          if (!uniqueMap.has(key)) uniqueMap.set(key, w);
        });
        const uniqueWinningNumbers = Array.from(uniqueMap.values());

        setWinningNumbers(uniqueWinningNumbers);
        return uniqueWinningNumbers;
      }
      setWinningNumbers([]);
      return [];
    } catch (err) {
      console.error('Error fetching winning numbers', err);
      setWinningNumbers([]);
      return [];
    }
  };

  const checkPositionalMatch = (entry, winningNumber) => {
    const cleanEntry = String(entry).trim();
    if (cleanEntry.includes('+')) {
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\+\d$/)) { if (winningNumber[1] === cleanEntry[1] && winningNumber[3] === cleanEntry[3]) return true; }
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\+$/)) { if (winningNumber.slice(1,3) === cleanEntry.slice(1,3)) return true; }
      if (cleanEntry.length === 4 && cleanEntry.match(/^\d\+\d\+$/)) { if (winningNumber[0] === cleanEntry[0] && winningNumber[2] === cleanEntry[2]) return true; }
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\+\d\d$/)) { if (winningNumber.slice(2) === cleanEntry.slice(2)) return true; }
      if (cleanEntry.length === 4 && cleanEntry.match(/^\d\d\+\d$/)) { if (winningNumber.slice(0,2) === cleanEntry.slice(0,2) && winningNumber[3] === cleanEntry[3]) return true; }
      if (cleanEntry.length === 4 && cleanEntry.match(/^\d\+\d\d$/)) { if (winningNumber[0] === cleanEntry[0] && winningNumber.slice(2) === cleanEntry.slice(2)) return true; }
      if (cleanEntry.length === 4 && cleanEntry.match(/^\+\d\d\d$/)) { if (winningNumber.slice(1) === cleanEntry.slice(1)) return true; }
      if (cleanEntry.length === 3 && cleanEntry.match(/^\+\d\d$/)) { if (winningNumber.slice(-2) === cleanEntry.slice(1)) return true; }
      if (cleanEntry.length === 2 && cleanEntry.match(/^\+\d$/)) { if (winningNumber.slice(-1) === cleanEntry.slice(1)) return true; }
      if (cleanEntry.length >= 2 && cleanEntry.length <= 3 && /^\d+$/.test(cleanEntry)) { if (winningNumber.startsWith(cleanEntry)) return true; }
      if (cleanEntry.length === 1 && /^\d$/.test(cleanEntry)) { if (winningNumber[0] === cleanEntry) return true; }
    }

    // Special handling for 4-digit plain numbers (PANGORA section):
    // treat them as matching if they equal either the first 4 or the
    // last 4 digits of the 6-digit winning number.
    if (cleanEntry.length === 4 && /^\d{4}$/.test(cleanEntry)) {
      const winStr = String(winningNumber).trim();
      if (winStr.length >= 4 && winStr.slice(0, 4) === cleanEntry) {
        return true;
      }
    }

    if (cleanEntry.length >= 2 && cleanEntry.length <= 3 && /^\d+$/.test(cleanEntry)) { if (winningNumber.startsWith(cleanEntry)) return true; }
    if (cleanEntry.length === 1 && /^\d$/.test(cleanEntry)) { if (winningNumber[0] === cleanEntry) return true; }
    return false;
  };

  const getEntryColor = (entryNumber) => {
    for (const winning of winningNumbers) if (entryNumber === winning.number) return winning.color;
    for (const winning of winningNumbers) if (checkPositionalMatch(entryNumber, winning.number)) return winning.color;
    return [0,0,0];
  };

  // Format numbers consistently to 2 decimal places and avoid
  // floating point artifacts like 5.1499999999999995.
  const formatCurrency = (value) => {
    const n = Number(value) || 0;
    return (Math.round(n * 100) / 100).toFixed(2);
  };

  const generateCombinedVoucherPDF = async (printMode = false) => {
    const fetchedEntries = await fetchCombinedVoucherData();
    if (!fetchedEntries || fetchedEntries.length === 0) {
      toast('No combined records found..');
      return;
    }

    // Ensure returned records actually match the selected TimeSlot and date.
    const toISO = (d) => { try { if (!d) return ''; const dt = typeof d === 'string' ? new Date(d) : new Date(d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch (e) { return ''; } };
    const selDateISO = selectedDraw && selectedDraw.draw_date ? toISO(selectedDraw.draw_date) : toISO(drawDate);
    const selTimeLabel = selectedDraw ? (formatTimeSlotLabel(selectedDraw) || selectedDraw.label || (typeof selectedDraw.hour === 'number' ? `${String(selectedDraw.hour).padStart(2,'0')}:00` : drawTime)) : drawTime;
    let entries = Array.isArray(fetchedEntries) ? fetchedEntries.slice() : [];
    entries = entries.filter((entry) => {
      // If backend populated timeSlotId as object, compare IDs
      if (entry.timeSlotId) {
        const entryTsId = (entry.timeSlotId && (entry.timeSlotId._id || entry.timeSlotId.toString())) || entry.timeSlotId;
        if (selectedDraw && selectedDraw._id && String(entryTsId) === String(selectedDraw._id)) return true;
      }
      // Compare explicit timeSlot string and date
      const entryTime = entry.timeSlot || '';
      const entryDate = entry.date ? toISO(entry.date) : '';
      if (selDateISO && entryDate && selDateISO === entryDate && selTimeLabel && entryTime && (entryTime === selTimeLabel || entryTime === (selectedDraw?.label || selTimeLabel))) return true;
      return false;
    });

    // Fetch winning numbers specifically for this PDF so coloring
    // is always based on fresh data in this function (no race with
    // async state updates).
    const winnersForColor = await getWinningNumbers(drawDate);

    const doc = new jsPDF('p','mm','a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const saveOrPrint = (docObj, filename) => {
      if (printMode) {
        try {
          const blobUrl = docObj.output('bloburl');
          const w = window.open(blobUrl);
          if (!w) toast.error('Popup blocked. Allow popups to use Print.');
        } catch (err) {
          console.error('Print error', err);
          toast.error('Unable to print.');
        }
      } else {
        docObj.save(filename);
      }
    };

    const allVoucherRows = entries.flatMap((entry) => (entry.data || []).map((item) => ({ number: item.uniqueId, first: item.firstPrice, second: item.secondPrice, dealer: entry.userId?.username, dealerId: entry.userId?.dealerId })));

    const combinedEntries = {};
    allVoucherRows.forEach(({ number, first, second, dealer, dealerId }) => {
      const key = number;
      if (combinedEntries[key]) {
        combinedEntries[key].first += Number(first || 0);
        combinedEntries[key].second += Number(second || 0);
        combinedEntries[key].dealers.add(`${dealer}(${dealerId})`);
        combinedEntries[key].count += 1;
      } else {
        combinedEntries[key] = { number, first: Number(first || 0), second: Number(second || 0), dealers: new Set([`${dealer}(${dealerId})`]), count: 1 };
      }
    });

    const processedEntries = Object.values(combinedEntries).map((entry) => ({ ...entry, dealers: Array.from(entry.dealers).join(', ') }));

    const hinsa = [], akra = [], tandola = [], pangora = [];
    processedEntries.forEach(({ number, first, second, dealers, count }) => {
      if (/^\d{1}$/.test(number) || (number.includes('+') && number.length === 2) || (number.split('+').length - 1 === 2 && number.length === 3) || (number.split('+').length - 1 === 3 && number.length === 4)) {
        if (prizeType === 'All' || prizeType === 'Hinsa') hinsa.push([number, first, second, dealers, count]);
      } else if (/^\d{2}$/.test(number) || (number.includes('+') && number.length <= 3) || (number.split('+').length - 1 === 2 && number.length === 4)) {
        if (prizeType === 'All' || prizeType === 'Akra') akra.push([number, first, second, dealers, count]);
      } else if (/^\d{3}$/.test(number) || (number.length === 4 && number.includes('+'))) {
        if (prizeType === 'All' || prizeType === 'Tandola') tandola.push([number, first, second, dealers, count]);
      } else if (/^\d{4}$/.test(number)) {
        if (prizeType === 'All' || prizeType === 'Pangora') pangora.push([number, first, second, dealers, count]);
      }
    });

    const sortEntries = (entries) => entries.sort((a,b) => { const numA = a[0].replace(/\+/g,''); const numB = b[0].replace(/\+/g,''); return numA.localeCompare(numB, undefined, { numeric: true }); });
    sortEntries(hinsa); sortEntries(akra); sortEntries(tandola); sortEntries(pangora);

    const calculateSectionTotals = (rows) => rows.reduce((acc, row) => { acc.firstTotal += row[1]; acc.secondTotal += row[2]; acc.recordCount += row[4]; return acc; }, { firstTotal:0, secondTotal:0, recordCount:0 });
    const hinsaTotals = calculateSectionTotals(hinsa); const akraTotals = calculateSectionTotals(akra); const tandolaTotals = calculateSectionTotals(tandola); const pangoraTotals = calculateSectionTotals(pangora);
    const grandTotals = { firstTotal: hinsaTotals.firstTotal + akraTotals.firstTotal + tandolaTotals.firstTotal + pangoraTotals.firstTotal, secondTotal: hinsaTotals.secondTotal + akraTotals.secondTotal + tandolaTotals.secondTotal + pangoraTotals.secondTotal, recordCount: hinsaTotals.recordCount + akraTotals.recordCount + tandolaTotals.recordCount + pangoraTotals.recordCount };
    const grandTotal = grandTotals.firstTotal + grandTotals.secondTotal;

    const getEntryColorForPdf = (entryNumber) => {
      // Prefer winners fetched for this PDF call; fall back to
      // component state if for some reason that array is empty.
      const source = (winnersForColor && winnersForColor.length) ? winnersForColor : winningNumbers;
      for (const winning of source) if (entryNumber === winning.number) return winning.color;
      for (const winning of source) if (checkPositionalMatch(entryNumber, winning.number)) return winning.color;
      return [0, 0, 0];
    };

    const addHeader = () => {
      doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text('Total Sale Report', pageWidth/2, 15, { align: 'center' });
      doc.setFontSize(12); doc.setFont('helvetica','normal');
      // Show Dealer for regular users, Main Distributor for distributors
      if (role === 'user') {
        doc.text(`Dealer: ${userData?.user?.username} (${userData?.user?.dealerId})`, 14, 30);
      } else {
        doc.text(`Main Distributor: ${userData?.user?.username} (${userData?.user?.dealerId})`, 14, 30);
      }
      if (userData?.user?.city) doc.text(`City: ${userData?.user?.city}`, 14, 40);
      const formatDisplayDate = (d) => { try { if (!d) return ''; const dt = typeof d === 'string' ? new Date(d) : new Date(d); if (isNaN(dt.getTime())) return d || ''; return dt.toLocaleDateString(); } catch (e) { return d || ''; } };
      const slotLabel = selectedDraw ? (formatTimeSlotLabel(selectedDraw) || selectedDraw.title || selectedDraw.label || `Slot_${selectedDraw._id}`) : '';
      const drawHeaderLabel = selectedDraw ? `${slotLabel}${selectedDraw.draw_date ? ` (${formatDisplayDate(selectedDraw.draw_date)})` : ''}` : formatDisplayDate(drawDate) || drawDate;
      doc.text(`Draw: ${drawHeaderLabel}`, 14, 50);
      doc.text(`First Total: ${formatCurrency(grandTotals.firstTotal)}`, 110, 50);
      doc.text(`Second Total: ${formatCurrency(grandTotals.secondTotal)}`, 110, 60);
      doc.text(`Grand Total: ${formatCurrency(grandTotal)}`, 110, 70);
    };

    const renderSection = (title, rows, startY=90) => {
      if (rows.length === 0) return startY;
      const rowHeight = 8; const colWidths = [20,17,17]; const tableWidth = colWidths.reduce((a,b)=>a+b,0); let y = startY;
      const totals = calculateSectionTotals(rows); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(`${title} (${rows.length} entries)`, 14, y); y+=8;
      doc.setFontSize(10); doc.setFont('helvetica','normal');
      doc.text(`First Total: ${formatCurrency(totals.firstTotal)}`, 14, y);
      doc.text(`Second Total: ${formatCurrency(totals.secondTotal)}`, 60, y);
      doc.text(`Total: ${formatCurrency(totals.firstTotal + totals.secondTotal)}`, 106, y); y+=5;
      const leftRows=[], middleRows=[], rightRows=[]; rows.forEach((r, idx)=>{ if(idx%3===0) leftRows.push(r); else if(idx%3===1) middleRows.push(r); else rightRows.push(r); });
      const leftX = 14; const middleX = leftX + tableWidth; const rightX = middleX + tableWidth;
      const drawTableHeader = (x, yy)=>{ doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setFillColor(230,230,230); doc.setDrawColor(0,0,0); doc.rect(x, yy, colWidths[0], rowHeight, 'FD'); doc.rect(x+colWidths[0], yy, colWidths[1], rowHeight, 'FD'); doc.rect(x+colWidths[0]+colWidths[1], yy, colWidths[2], rowHeight, 'FD'); doc.setTextColor(0,0,0); doc.text('Number', x+1, yy+5); doc.text('First', x+colWidths[0]+1, yy+5); doc.text('Second', x+colWidths[0]+colWidths[1]+1, yy+5); doc.setFillColor(255,255,255); return yy+rowHeight; };
      let headerY = drawTableHeader(leftX, y); if(middleRows.length>0) drawTableHeader(middleX, y); if(rightRows.length>0) drawTableHeader(rightX, y);
      let currentY = headerY; doc.setFont('helvetica','normal'); doc.setFontSize(8);
      const maxRows = Math.max(leftRows.length, middleRows.length, rightRows.length);
      for(let i=0;i<maxRows;i++){
        if(currentY > pageHeight - 30){ doc.addPage(); currentY = 35; drawTableHeader(leftX, currentY); if(middleRows.length>0) drawTableHeader(middleX, currentY); if(rightRows.length>0) drawTableHeader(rightX, currentY); currentY += rowHeight; doc.setFont('helvetica','normal'); doc.setFontSize(8); }
        if(i<leftRows.length){ const [num,f,s] = leftRows[i]; const entryColor = getEntryColorForPdf(num); doc.setFillColor(245,245,245); doc.setDrawColor(0,0,0); doc.rect(leftX, currentY, colWidths[0], rowHeight, 'FD'); doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]); doc.text(num.toString(), leftX+1, currentY+5); doc.setFillColor(255,255,255); doc.rect(leftX+colWidths[0], currentY, colWidths[1], rowHeight); doc.text(formatCurrency(f), leftX+colWidths[0]+1, currentY+5); doc.rect(leftX+colWidths[0]+colWidths[1], currentY, colWidths[2], rowHeight); doc.text(formatCurrency(s), leftX+colWidths[0]+colWidths[1]+1, currentY+5); doc.setTextColor(0,0,0); }
        if(i<middleRows.length){ const [num,f,s] = middleRows[i]; const entryColor = getEntryColorForPdf(num); doc.setFillColor(245,245,245); doc.setDrawColor(0,0,0); doc.rect(middleX, currentY, colWidths[0], rowHeight, 'FD'); doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]); doc.text(num.toString(), middleX+1, currentY+5); doc.setFillColor(255,255,255); doc.rect(middleX+colWidths[0], currentY, colWidths[1], rowHeight); doc.text(formatCurrency(f), middleX+colWidths[0]+1, currentY+5); doc.rect(middleX+colWidths[0]+colWidths[1], currentY, colWidths[2], rowHeight); doc.text(formatCurrency(s), middleX+colWidths[0]+colWidths[1]+1, currentY+5); doc.setTextColor(0,0,0); }
        if(i<rightRows.length){ const [num,f,s] = rightRows[i]; const entryColor = getEntryColorForPdf(num); doc.setFillColor(245,245,245); doc.setDrawColor(0,0,0); doc.rect(rightX, currentY, colWidths[0], rowHeight, 'FD'); doc.setTextColor(entryColor[0], entryColor[1], entryColor[2]); doc.text(num.toString(), rightX+1, currentY+5); doc.setFillColor(255,255,255); doc.rect(rightX+colWidths[0], currentY, colWidths[1], rowHeight); doc.text(formatCurrency(f), rightX+colWidths[0]+1, currentY+5); doc.rect(rightX+colWidths[0]+colWidths[1], currentY, colWidths[2], rowHeight); doc.text(formatCurrency(s), rightX+colWidths[0]+colWidths[1]+1, currentY+5); doc.setTextColor(0,0,0); }
        currentY += rowHeight;
      }
      return currentY + 10;
    };

    addHeader(); let nextY = 100; if(hinsa.length>0) nextY = renderSection('HINSA', hinsa, nextY); if(akra.length>0) nextY = renderSection('AKRA', akra, nextY); if(tandola.length>0) nextY = renderSection('TANDOLA', tandola, nextY); if(pangora.length>0) nextY = renderSection('PANGORA', pangora, nextY);

    const safeISODate = (d) => { try { if (!d) return 'unknown_date'; const dt = typeof d === 'string' ? new Date(d) : new Date(d); if (isNaN(dt.getTime())) return 'unknown_date'; return dt.toISOString().split('T')[0]; } catch (e) { return 'unknown_date'; } };
    const slotFileLabel = selectedDraw ? (formatTimeSlotLabel(selectedDraw) || selectedDraw.title || selectedDraw.label || 'draw') : 'draw';
    const drawFileLabel = `${slotFileLabel.replace(/\s+/g,'_')}_${safeISODate(selectedDraw && selectedDraw.draw_date ? selectedDraw.draw_date : drawDate)}`;
    const filename = `Combined_Voucher_${drawFileLabel}.pdf`;
    saveOrPrint(doc, filename);
    toast.success('Combined Voucher PDF processed');
  };

  const isSelectedDrawClosed = () => {
    if (selectedDraw) {
      if (typeof selectedDraw.isActive === 'boolean') return selectedDraw.isActive === false;
      if (typeof selectedDraw.isExpired === 'boolean') return selectedDraw.isExpired;
      if (selectedDraw.draw_date) {
        const d = new Date(selectedDraw.draw_date);
        d.setHours(23,59,59,999);
        return Date.now() > d.getTime();
      }
      return false;
    }
    if (drawDate) { const d = new Date(drawDate); d.setHours(23,59,59,999); return Date.now() > d.getTime(); }
    return false;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Total Sale Report</h2>
      <div className="grid grid-cols-3 gap-4">
        <div>
            <label className="block text-sm ">Select Time Slot</label>
          <select
            className="bg-gray-800 p-2 rounded w-full text-white"
            value={selectedDraw?._id || ''}
            onChange={(e) => setSelectedDraw(draws.find(d => String(d._id) === String(e.target.value)) || null)}
            style={{ color: '#fff' }}
          >
            <option value="">-- Select time slot date --</option>
            {draws.slice().sort((a,b)=>{
              const ah = typeof a.hour === 'number' ? a.hour : parseInt((a.label||'').match(/^(\d{1,2})/)?.[1]||'0',10);
              const bh = typeof b.hour === 'number' ? b.hour : parseInt((b.label||'').match(/^(\d{1,2})/)?.[1]||'0',10);
              return ah - bh;
            }).map(d => (
              <option key={d._id} value={d._id} style={{ color: '#000' }}>
                {formatTimeSlotLabel ? formatTimeSlotLabel(d) : (d.title || d.label || '')}{d.draw_date ? ` - ${new Date(d.draw_date).toLocaleDateString()}` : ''}{d.isActive === false ? ' (Closed)' : d.isActive === true ? ' (Active)' : ''}
              </option>
            ))}
          </select>

          <label className="block text-sm mt-2">Date</label>
          <input
            type="date"
            value={drawDate}
            onChange={(e) => setDrawDate(e.target.value)}
            className="bg-gray-800 p-2 rounded w-full text-white"
            style={{ color: '#fff' }}
          />
        </div>

        <div>
          <label className="block text-sm">Prize Type</label>
          <select className="bg-gray-800 p-2 rounded w-full" value={prizeType} onChange={(e) => setPrizeType(e.target.value)}>
            <option>All</option>
            <option>Hinsa</option>
            <option>Akra</option>
            <option>Tandola</option>
            <option>Pangora</option>
          </select>
        </div>

        <div>
          <label className="block text-sm">(Choose combined report type)</label>
          <select className="bg-gray-800 p-2 rounded w-full" value={ledger} onChange={(e) => setLedger(e.target.value)}>
            <option value="general">Combined General</option>
          </select>
        </div>
        
      </div>

      

      <div className="space-x-2 mt-4">
        <button className="bg-blue-600 px-4 py-2 rounded" onClick={async () => {
          if (!isSelectedDrawClosed()) { toast.error('Draw is not close yet'); return; }
          await generateCombinedVoucherPDF(false);
        }}>Download PDF</button>

        <button className="bg-green-600 px-4 py-2 rounded" onClick={async () => {
          if (!isSelectedDrawClosed()) { toast.error('Draw is not close yet'); return; }
          await generateCombinedVoucherPDF(true);
        }}>Print</button>
      </div>
    </div>
  );
};



export default TotalSaleReport;
