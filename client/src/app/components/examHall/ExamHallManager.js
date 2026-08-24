"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Calendar,
  Users,
  Building2,
  Search,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  Grid,
} from 'lucide-react';
import styles from './exam-hall.module.css';
import { exportHallLandscapePdf, exportAllHallsLandscapePdf } from './examHallPdf';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

// Color palette mapping helper for subject badges
const SUBJECT_COLORS = [
  styles.subColor0,
  styles.subColor1,
  styles.subColor2,
  styles.subColor3,
  styles.subColor4,
  styles.subColor5,
  styles.subColor6,
  styles.subColor7,
];

export default function ExamHallManager({ userRole = 'Admin' }) {
  const api = useMemo(
    () =>
      axios.create({
        baseURL: `${API_BASE}/api/exam-hall`,
        withCredentials: true,
      }),
    []
  );

  // ---------- State ----------
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Printable Refs
  const singleHallPrintRef = useRef(null);
  const allHallsContainerRef = useRef(null);

  // Candidates state
  const [candidateTab, setCandidateTab] = useState('range'); // 'range' | 'manual' | 'list'
  const [candidates, setCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');

  // Range form
  const [rangeForm, setRangeForm] = useState({
    subjectCode: '',
    subjectName: '',
    registerNoFrom: '',
    registerNoTo: '',
    defaultNamePrefix: '',
  });

  // Manual rows form
  const [manualRows, setManualRows] = useState([
    { registerNo: '', name: '', subjectCode: '', subjectName: '' },
  ]);

  // Halls state
  const [halls, setHalls] = useState([]);
  const [selectedHallIds, setSelectedHallIds] = useState([]);
  const [hallForm, setHallForm] = useState({
    hallNumber: '',
    layoutType: 'FIVE_BY_FIVE',
  });

  // Allocation / Seating state
  const [seatingData, setSeatingData] = useState(null);
  const [activeHallViewId, setActiveHallViewId] = useState('');
  const [allocating, setAllocating] = useState(false);

  // Search state
  const [searchRegNo, setSearchRegNo] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Modals
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    examName: '',
    examDate: new Date().toISOString().split('T')[0],
    session: 'FN',
  });

  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editingHall, setEditingHall] = useState(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showDeleteAllocationModal, setShowDeleteAllocationModal] = useState(false);

  // ---------- Helpers ----------
  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert({ type: '', message: '' }), 6000);
  };

  const activeSession = useMemo(
    () => sessions.find((s) => s._id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  // Subject color map
  const subjectColorMap = useMemo(() => {
    const map = {};
    let colorIndex = 0;
    candidates.forEach((c) => {
      const code = (c.subjectCode || '').toUpperCase();
      if (!map[code]) {
        map[code] = SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
        colorIndex++;
      }
    });
    return map;
  }, [candidates]);

  // ---------- Data Fetching ----------
  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/sessions');
      if (res.data.success) {
        setSessions(res.data.data);
        if (res.data.data.length > 0 && !selectedSessionId) {
          setSelectedSessionId(res.data.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      showAlert('error', err.response?.data?.message || 'Failed to fetch exam sessions.');
    }
  }, [api, selectedSessionId]);

  const fetchHalls = useCallback(async () => {
    try {
      const res = await api.get('/halls');
      if (res.data.success) {
        setHalls(res.data.data);
        setSelectedHallIds(res.data.data.filter((h) => h.active).map((h) => h._id));
      }
    } catch (err) {
      console.error('Error fetching halls:', err);
    }
  }, [api]);

  const fetchSessionDetails = useCallback(async () => {
    if (!selectedSessionId) return;
    try {
      const candRes = await api.get(`/candidates/${selectedSessionId}`);
      if (candRes.data.success) {
        setCandidates(candRes.data.data);
      }

      const seatRes = await api.get(`/seating/${selectedSessionId}`);
      if (seatRes.data.success) {
        setSeatingData(seatRes.data);
        if (seatRes.data.halls && seatRes.data.halls.length > 0) {
          setActiveHallViewId(seatRes.data.halls[0].hallId);
        }
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
    }
  }, [api, selectedSessionId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessRes, hallsRes] = await Promise.all([
          api.get('/sessions'),
          api.get('/halls'),
        ]);
        if (active) {
          if (sessRes.data?.success) {
            setSessions(sessRes.data.data);
            if (sessRes.data.data.length > 0) {
              setSelectedSessionId(sessRes.data.data[0]._id);
            }
          }
          if (hallsRes.data?.success) {
            setHalls(hallsRes.data.data);
            setSelectedHallIds(hallsRes.data.data.filter((h) => h.active).map((h) => h._id));
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial load error:', err);
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!selectedSessionId) return;
    let active = true;
    (async () => {
      try {
        const [candRes, seatRes] = await Promise.all([
          api.get(`/candidates/${selectedSessionId}`),
          api.get(`/seating/${selectedSessionId}`),
        ]);
        if (active) {
          if (candRes.data?.success) {
            setCandidates(candRes.data.data);
          }
          if (seatRes.data?.success) {
            setSeatingData(seatRes.data);
            if (seatRes.data.halls && seatRes.data.halls.length > 0) {
              setActiveHallViewId(seatRes.data.halls[0].hallId);
            }
          }
        }
      } catch (err) {
        console.error('Session details load error:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, selectedSessionId]);

  // ---------- Session Handlers ----------
  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/sessions', sessionForm);
      if (res.data.success) {
        showAlert('success', 'Exam Session created successfully.');
        setShowSessionModal(false);
        setSessionForm({
          examName: '',
          examDate: new Date().toISOString().split('T')[0],
          session: 'FN',
        });
        await fetchSessions();
        setSelectedSessionId(res.data.data._id);
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to create session.');
    }
  };

  // ---------- Candidate Handlers ----------
  const handleAddRangeCandidates = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) {
      showAlert('error', 'Please select or create an Exam Session first.');
      return;
    }
    try {
      const res = await api.post('/candidates/range', {
        sessionId: selectedSessionId,
        ...rangeForm,
      });
      if (res.data.success) {
        showAlert('success', res.data.message);
        setRangeForm({
          subjectCode: '',
          subjectName: '',
          registerNoFrom: '',
          registerNoTo: '',
          defaultNamePrefix: '',
        });
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to add range candidates.');
    }
  };

  const handleAddManualRow = () => {
    setManualRows([...manualRows, { registerNo: '', name: '', subjectCode: '', subjectName: '' }]);
  };

  const handleRemoveManualRow = (index) => {
    if (manualRows.length <= 1) return;
    setManualRows(manualRows.filter((_, i) => i !== index));
  };

  const handleManualRowChange = (index, field, value) => {
    const updated = [...manualRows];
    updated[index][field] = value;
    setManualRows(updated);
  };

  const handleAddManualCandidates = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) {
      showAlert('error', 'Please select or create an Exam Session first.');
      return;
    }
    try {
      const res = await api.post('/candidates/manual', {
        sessionId: selectedSessionId,
        candidates: manualRows,
      });
      if (res.data.success) {
        showAlert('success', res.data.message);
        setManualRows([{ registerNo: '', name: '', subjectCode: '', subjectName: '' }]);
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to add candidates.');
    }
  };

  const handleUpdateCandidate = async (e) => {
    e.preventDefault();
    if (!editingCandidate) return;
    try {
      const res = await api.put(`/candidates/${editingCandidate._id}`, editingCandidate);
      if (res.data.success) {
        showAlert('success', 'Candidate updated successfully.');
        setEditingCandidate(null);
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to update candidate.');
    }
  };

  const handleDeleteCandidate = async (cand) => {
    if (
      !window.confirm(
        `Are you sure you want to delete candidate "${cand.registerNo}"?${
          activeSession?.status === 'ALLOCATED'
            ? '\n\nNote: An allocation exists. Deleting will free this seat and may require regeneration.'
            : ''
        }`
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(`/candidates/${cand._id}`);
      if (res.data.success) {
        showAlert('success', 'Candidate deleted successfully.');
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete candidate.');
    }
  };

  // ---------- Hall Handlers ----------
  const handleCreateHall = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/halls', hallForm);
      if (res.data.success) {
        showAlert('success', 'Hall created successfully with capacity 25.');
        setHallForm({ hallNumber: '', layoutType: 'FIVE_BY_FIVE' });
        await fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to create hall.');
    }
  };

  const handleUpdateHall = async (e) => {
    e.preventDefault();
    if (!editingHall) return;
    try {
      const res = await api.put(`/halls/${editingHall._id}`, editingHall);
      if (res.data.success) {
        showAlert('success', 'Hall updated successfully.');
        setEditingHall(null);
        await fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to update hall.');
    }
  };

  const handleDeleteHall = async (hall) => {
    if (!window.confirm(`Are you sure you want to delete Hall "${hall.hallNumber}"?`)) {
      return;
    }
    try {
      const res = await api.delete(`/halls/${hall._id}`);
      if (res.data.success) {
        showAlert('success', 'Hall deleted successfully.');
        await fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete hall.');
    }
  };

  const toggleHallSelection = (hallId) => {
    setSelectedHallIds((prev) =>
      prev.includes(hallId) ? prev.filter((id) => id !== hallId) : [...prev, hallId]
    );
  };

  // ---------- Allocation Handlers ----------
  const totalSelectedCapacity = selectedHallIds.length * 25;
  const isCapacitySufficient = totalSelectedCapacity >= candidates.length;

  const handleGenerateAllocation = async () => {
    if (!selectedSessionId) {
      showAlert('error', 'Please select an exam session.');
      return;
    }
    if (candidates.length === 0) {
      showAlert('error', 'Please add candidates before generating allocation.');
      return;
    }
    if (selectedHallIds.length === 0) {
      showAlert('error', 'Please select at least one hall.');
      return;
    }
    if (!isCapacitySufficient) {
      showAlert(
        'error',
        `Not enough hall capacity. Total Candidates: ${candidates.length}, Total Capacity: ${totalSelectedCapacity}. Please select more halls.`
      );
      return;
    }

    try {
      setAllocating(true);
      const res = await api.post('/allocation/generate', {
        sessionId: selectedSessionId,
        hallIds: selectedHallIds,
      });
      if (res.data.success) {
        showAlert('success', res.data.message);
        await fetchSessions();
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Allocation failed.');
    } finally {
      setAllocating(false);
    }
  };

  const handleRegenerateAllocation = async () => {
    setShowRegenerateModal(false);
    await handleGenerateAllocation();
  };

  const handleDeleteAllocation = async () => {
    setShowDeleteAllocationModal(false);
    try {
      const res = await api.delete(`/allocation/${selectedSessionId}`);
      if (res.data.success) {
        showAlert('success', res.data.message);
        setSeatingData(null);
        await fetchSessions();
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete allocation.');
    }
  };

  // ---------- Candidate Search ----------
  const handleSearchCandidate = async (e) => {
    e.preventDefault();
    if (!selectedSessionId || !searchRegNo.trim()) return;
    try {
      setSearchLoading(true);
      setSearchResult(null);
      const res = await api.get('/search', {
        params: { sessionId: selectedSessionId, registerNo: searchRegNo.trim() },
      });
      if (res.data.success) {
        setSearchResult(res.data.data);
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Candidate not found in this exam session.');
    } finally {
      setSearchLoading(false);
    }
  };

  // ---------- PDF Export Handlers ----------
  const activeHallData = useMemo(() => {
    if (!seatingData || !seatingData.halls) return null;
    return seatingData.halls.find((h) => h.hallId === activeHallViewId) || seatingData.halls[0];
  }, [seatingData, activeHallViewId]);

  const handleDownloadSinglePdf = async () => {
    if (!activeSession || !activeHallData) {
      showAlert('error', 'No seating data available for PDF export.');
      return;
    }
    const element = singleHallPrintRef.current;
    if (!element) return;

    try {
      setPdfGenerating(true);
      const filename = `Exam_Seating_${activeHallData.hallNumber || 'Hall'}_${activeSession.session || 'FN'}.pdf`;
      await exportHallLandscapePdf(element, filename);
      showAlert('success', 'Landscape PDF downloaded successfully.');
    } catch (err) {
      console.error('Single Hall PDF error:', err);
      showAlert('error', 'Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadAllPdf = async () => {
    if (!activeSession || !seatingData?.halls?.length) {
      showAlert('error', 'No seating data available for PDF export.');
      return;
    }
    const container = allHallsContainerRef.current;
    if (!container) return;

    const hallSheets = container.querySelectorAll(`.${styles.printSheet}`);
    if (!hallSheets || hallSheets.length === 0) return;

    try {
      setPdfGenerating(true);
      const filename = `Exam_Seating_ALL_HALLS_${(activeSession.examName || 'Exam').replace(/\s+/g, '_')}_${activeSession.session || 'FN'}.pdf`;
      await exportAllHallsLandscapePdf(Array.from(hallSheets), filename);
      showAlert('success', 'All Halls Landscape PDF downloaded successfully.');
    } catch (err) {
      console.error('All Halls PDF error:', err);
      showAlert('error', 'Failed to generate All Halls PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // Filtered candidate list
  const filteredCandidates = useMemo(() => {
    if (!candidateSearch.trim()) return candidates;
    const q = candidateSearch.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        c.registerNo.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.subjectCode.toLowerCase().includes(q)
    );
  }, [candidates, candidateSearch]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Exam Hall Allocation</h1>
          <p>Autonomous Examination Seating &amp; Candidate Allocation Engine</p>
        </div>

        <div className={styles.sessionSelectorArea}>
          <div className={styles.formGroup}>
            <select
              className={styles.sessionSelect}
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              {sessions.length === 0 ? (
                <option value="">No Exam Sessions Found</option>
              ) : (
                sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.examName} ({new Date(s.examDate).toLocaleDateString('en-GB')} - {s.session}) [
                    {s.status}]
                  </option>
                ))
              )}
            </select>
          </div>

          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowSessionModal(true)}>
            <Plus size={16} /> New Exam
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert.message && (
        <div
          className={`${styles.alert} ${
            alert.type === 'success' ? styles.alertSuccess : styles.alertError
          }`}
        >
          <span>{alert.message}</span>
          <button className={styles.modalClose} onClick={() => setAlert({ type: '', message: '' })}>
            ×
          </button>
        </div>
      )}

      {/* ==================== 1. ADD CANDIDATES (FIRST SECTION) ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Users size={20} /> 1. Candidate Entry
          </h2>
          <span className={`${styles.badge} ${styles.badgeDraft}`}>
            Total Registered: {candidates.length}
          </span>
        </div>

        <div className={styles.tabsNav}>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'range' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('range')}
          >
            A. Register Range
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'manual' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('manual')}
          >
            B. Manual Entry Rows
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'list' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('list')}
          >
            Candidate List ({candidates.length})
          </button>
        </div>

        {/* Tab A: Range Entry */}
        {candidateTab === 'range' && (
          <form onSubmit={handleAddRangeCandidates}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Subject Code *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. MA3391"
                  value={rangeForm.subjectCode}
                  onChange={(e) => setRangeForm({ ...rangeForm, subjectCode: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Subject Name (Optional)</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Transforms & PDE"
                  value={rangeForm.subjectName}
                  onChange={(e) => setRangeForm({ ...rangeForm, subjectName: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Register Number From *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 86002324301"
                  value={rangeForm.registerNoFrom}
                  onChange={(e) => setRangeForm({ ...rangeForm, registerNoFrom: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Register Number To *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 86002324320"
                  value={rangeForm.registerNoTo}
                  onChange={(e) => setRangeForm({ ...rangeForm, registerNoTo: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Name Prefix (Optional)</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Student"
                  value={rangeForm.defaultNamePrefix}
                  onChange={(e) => setRangeForm({ ...rangeForm, defaultNamePrefix: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className={`${styles.btn} ${styles.btnSuccess}`}>
              <Plus size={16} /> Add Range
            </button>
          </form>
        )}

        {/* Tab B: Manual Entry */}
        {candidateTab === 'manual' && (
          <form onSubmit={handleAddManualCandidates}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Register No. *</th>
                    <th>Candidate Name</th>
                    <th>Subject Code *</th>
                    <th>Subject Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="86002324301"
                          value={row.registerNo}
                          onChange={(e) => handleManualRowChange(idx, 'registerNo', e.target.value)}
                          required
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="Candidate Name"
                          value={row.name}
                          onChange={(e) => handleManualRowChange(idx, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="MA3391"
                          value={row.subjectCode}
                          onChange={(e) => handleManualRowChange(idx, 'subjectCode', e.target.value)}
                          required
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="Subject Name"
                          value={row.subjectName}
                          onChange={(e) => handleManualRowChange(idx, 'subjectName', e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => handleRemoveManualRow(idx)}
                          disabled={manualRows.length <= 1}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={handleAddManualRow}
              >
                + Add Row
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnSuccess}`}>
                <Plus size={16} /> Add Candidates
              </button>
            </div>
          </form>
        )}

        {/* Tab C: Candidate List */}
        {candidateTab === 'list' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                className={styles.input}
                placeholder="Search by Register No, Name, or Subject..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                style={{ maxWidth: '350px' }}
              />
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Register No.</th>
                    <th>Candidate Name</th>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                        No candidates found. Use Register Range or Manual Entry to add.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand, idx) => (
                      <tr key={cand._id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{cand.registerNo}</td>
                        <td>{cand.name}</td>
                        <td>
                          <span
                            className={styles.seatSubject}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                          >
                            {cand.subjectCode}
                          </span>
                        </td>
                        <td>{cand.subjectName || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                              onClick={() => setEditingCandidate(cand)}
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                              onClick={() => handleDeleteCandidate(cand)}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ==================== 2. HALL MANAGEMENT ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Building2 size={20} /> 2. Exam Halls Management
          </h2>
          <span className={`${styles.badge} ${styles.badgeAllocated}`}>
            Capacity per Hall: 25 Seats
          </span>
        </div>

        <form onSubmit={handleCreateHall} style={{ marginBottom: '20px' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Hall Number *</label>
              <input
                className={styles.input}
                placeholder="e.g. A101"
                value={hallForm.hallNumber}
                onChange={(e) => setHallForm({ ...hallForm, hallNumber: e.target.value })}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Layout Type *</label>
              <select
                className={styles.select}
                value={hallForm.layoutType}
                onChange={(e) => setHallForm({ ...hallForm, layoutType: e.target.value })}
              >
                <option value="FIVE_BY_FIVE">5 × 5 (25 Seats)</option>
                <option value="FOUR_BY_SIX_PLUS_ONE">4 × 6 + 1 (25 Seats)</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Fixed Capacity</label>
              <input className={`${styles.input} ${styles.inputDisabled}`} value="25" disabled />
            </div>

            <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                <Plus size={16} /> Add Hall
              </button>
            </div>
          </div>
        </form>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Select</th>
                <th>Hall Number</th>
                <th>Layout Geometry</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {halls.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    No halls added yet. Use form above to add exam halls.
                  </td>
                </tr>
              ) : (
                halls.map((hall) => {
                  const isSelected = selectedHallIds.includes(hall._id);
                  return (
                    <tr key={hall._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleHallSelection(hall._id)}
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>{hall.hallNumber}</td>
                      <td>{hall.layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? '4 × 6 + 1' : '5 × 5'}</td>
                      <td>25</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            hall.active ? styles.badgeAllocated : styles.badgeDraft
                          }`}
                        >
                          {hall.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                            onClick={() => setEditingHall(hall)}
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            onClick={() => handleDeleteHall(hall)}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================== 3. GENERATE ALLOCATION ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Grid size={20} /> 3. Seating Allocation Control
          </h2>
          <span
            className={`${styles.badge} ${
              activeSession?.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft
            }`}
          >
            Status: {activeSession?.status || 'DRAFT'}
          </span>
        </div>

        {/* Metric Cards */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{candidates.length}</div>
            <div className={styles.metricLabel}>Total Candidates</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{selectedHallIds.length}</div>
            <div className={styles.metricLabel}>Selected Halls</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>{totalSelectedCapacity}</div>
            <div className={styles.metricLabel}>Total Capacity</div>
          </div>
          <div className={styles.metricCard}>
            <div
              className={styles.metricValue}
              style={{ color: isCapacitySufficient ? '#16a34a' : '#dc2626' }}
            >
              {totalSelectedCapacity - candidates.length >= 0
                ? totalSelectedCapacity - candidates.length
                : 'Deficit'}
            </div>
            <div className={styles.metricLabel}>Available Seats</div>
          </div>
        </div>

        {!isCapacitySufficient && (
          <div className={`${styles.alert} ${styles.alertError}`} style={{ marginBottom: '16px' }}>
            <span>
              ⚠️ Not enough hall capacity! Candidates ({candidates.length}) exceed selected capacity (
              {totalSelectedCapacity}). Please select or add more halls.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {activeSession?.status === 'ALLOCATED' ? (
            <>
              <button
                className={`${styles.btn} ${styles.btnWarning}`}
                onClick={() => setShowRegenerateModal(true)}
                disabled={allocating}
              >
                <RefreshCw size={16} /> Regenerate Allocation
              </button>
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => setShowDeleteAllocationModal(true)}
              >
                <Trash2 size={16} /> Delete Allocation
              </button>
            </>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={handleGenerateAllocation}
              disabled={allocating || !isCapacitySufficient || candidates.length === 0}
            >
              <CheckCircle size={16} /> {allocating ? 'Allocating…' : 'Generate Allocation'}
            </button>
          )}
        </div>
      </section>

      {/* ==================== 4. COLORFUL HALL VIEW ==================== */}
      {seatingData && seatingData.halls && seatingData.halls.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>
              <Building2 size={20} /> 4. Physical Seating Arrangement (Hall View)
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleDownloadSinglePdf}
                disabled={pdfGenerating}
              >
                <Download size={15} /> {pdfGenerating ? 'Generating PDF...' : 'Download Hall PDF'}
              </button>
              <button
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={handleDownloadAllPdf}
                disabled={pdfGenerating}
              >
                <Download size={15} /> {pdfGenerating ? 'Generating All...' : 'Download All Halls PDF'}
              </button>
            </div>
          </div>

          {/* Hall Tabs */}
          <div className={styles.hallTabs}>
            {seatingData.halls.map((h) => {
              const isTabActive = h.hallId === (activeHallViewId || seatingData.halls[0].hallId);
              return (
                <button
                  key={h.hallId}
                  className={`${styles.hallTab} ${isTabActive ? styles.hallTabActive : ''}`}
                  onClick={() => setActiveHallViewId(h.hallId)}
                >
                  <span>{h.hallNumber}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isTabActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                    }}
                  >
                    {String(h.occupiedCount).padStart(2, '0')}/25
                  </span>
                </button>
              );
            })}
          </div>

          {/* Seating Grid View */}
          {activeHallData && (
            <div className={styles.seatingContainer}>
              <div
                className={`${styles.seatingGrid} ${
                  activeHallData.layoutType === 'FOUR_BY_SIX_PLUS_ONE'
                    ? styles.grid4x6
                    : styles.grid5x5
                }`}
              >
                {Array.from({ length: 25 }, (_, i) => i + 1).map((seatNum) => {
                  const seatRecord = activeHallData.seats ? activeHallData.seats[seatNum] : null;

                  if (seatRecord) {
                    const colorClass = subjectColorMap[seatRecord.subjectCode] || styles.subColor0;
                    return (
                      <div key={seatNum} className={`${styles.seatBox} ${colorClass}`}>
                        <div className={styles.seatHeader}>
                          <span>Seat {String(seatNum).padStart(2, '0')}</span>
                        </div>
                        <div className={styles.seatRegNo}>{seatRecord.registerNo}</div>
                        <div className={styles.seatSubject}>{seatRecord.subjectCode}</div>
                      </div>
                    );
                  }

                  // Empty seat: rendered with no text, clean empty box
                  return (
                    <div key={seatNum} className={`${styles.seatBox} ${styles.seatEmpty}`}>
                      <span className={styles.seatNoOnly}>{String(seatNum).padStart(2, '0')}</span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Subject Summary Table */}
              <div style={{ width: '100%', marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#334155' }}>
                  Hall {activeHallData.hallNumber} - Subject Summary:
                </h4>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Register Numbers Range</th>
                        <th>No. of Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeHallData.summaryList?.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{s.subjectCode}</td>
                          <td>{s.subjectName || '-'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{s.registerRange}</td>
                          <td style={{ fontWeight: 600 }}>{s.count}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan="3">TOTAL</td>
                        <td>{activeHallData.occupiedCount} / 25</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ==================== 5. CANDIDATE SEAT SEARCH ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Search size={20} /> 5. Candidate Seat Quick Search
          </h2>
        </div>

        <form onSubmit={handleSearchCandidate} style={{ display: 'flex', gap: '10px', maxWidth: '500px' }}>
          <input
            className={styles.input}
            placeholder="Enter Register Number (e.g. 86002324301)..."
            value={searchRegNo}
            onChange={(e) => setSearchRegNo(e.target.value)}
            required
          />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={searchLoading}>
            {searchLoading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>
              ✓ Candidate Found: {searchResult.name}
            </h4>
            <div className={styles.formGrid} style={{ margin: 0 }}>
              <div>
                <strong>Register No:</strong> {searchResult.registerNo}
              </div>
              <div>
                <strong>Subject:</strong> {searchResult.subjectCode}
              </div>
              <div>
                <strong>Hall Number:</strong>{' '}
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                  {searchResult.hallNumber}
                </span>
              </div>
              <div>
                <strong>Seat Number:</strong>{' '}
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>
                  Seat {String(searchResult.seatNo).padStart(2, '0')}
                </span>
              </div>
              <div>
                <strong>Row / Column:</strong> Row {searchResult.row}, Col {searchResult.column}
              </div>
              <div>
                <strong>Exam:</strong> {searchResult.examName} ({searchResult.session})
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================== MODALS ==================== */}

      {/* New Session Modal */}
      {showSessionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSessionModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create New Exam Session</h3>
              <button className={styles.modalClose} onClick={() => setShowSessionModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateSession}>
              <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
                <label>Exam Name *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Internal Examination 1"
                  value={sessionForm.examName}
                  onChange={(e) => setSessionForm({ ...sessionForm, examName: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
                <label>Exam Date *</label>
                <input
                  type="date"
                  className={styles.input}
                  value={sessionForm.examDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, examDate: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '20px' }}>
                <label>Session *</label>
                <select
                  className={styles.select}
                  value={sessionForm.session}
                  onChange={(e) => setSessionForm({ ...sessionForm, session: e.target.value })}
                >
                  <option value="FN">FN (Forenoon / Morning)</option>
                  <option value="AN">AN (Afternoon)</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setShowSessionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <div className={styles.modalOverlay} onClick={() => setEditingCandidate(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Candidate</h3>
              <button className={styles.modalClose} onClick={() => setEditingCandidate(null)}>
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateCandidate}>
              <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                <label>Register Number *</label>
                <input
                  className={styles.input}
                  value={editingCandidate.registerNo}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, registerNo: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                <label>Candidate Name *</label>
                <input
                  className={styles.input}
                  value={editingCandidate.name}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                <label>Subject Code *</label>
                <input
                  className={styles.input}
                  value={editingCandidate.subjectCode}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, subjectCode: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '20px' }}>
                <label>Subject Name</label>
                <input
                  className={styles.input}
                  value={editingCandidate.subjectName || ''}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, subjectName: e.target.value })}
                />
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setEditingCandidate(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hall Modal */}
      {editingHall && (
        <div className={styles.modalOverlay} onClick={() => setEditingHall(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Hall</h3>
              <button className={styles.modalClose} onClick={() => setEditingHall(null)}>
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateHall}>
              <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                <label>Hall Number *</label>
                <input
                  className={styles.input}
                  value={editingHall.hallNumber}
                  onChange={(e) => setEditingHall({ ...editingHall, hallNumber: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                <label>Layout Type *</label>
                <select
                  className={styles.select}
                  value={editingHall.layoutType}
                  onChange={(e) => setEditingHall({ ...editingHall, layoutType: e.target.value })}
                >
                  <option value="FIVE_BY_FIVE">5 × 5 (25 Seats)</option>
                  <option value="FOUR_BY_SIX_PLUS_ONE">4 × 6 + 1 (25 Seats)</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setEditingHall(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Update Hall
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      {showRegenerateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowRegenerateModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Confirm Regeneration</h3>
              <button className={styles.modalClose} onClick={() => setShowRegenerateModal(false)}>
                ×
              </button>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
              An allocation already exists for this examination. Regenerating will replace the current
              seating arrangement across all selected halls.
            </p>
            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setShowRegenerateModal(false)}
              >
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnWarning}`} onClick={handleRegenerateAllocation}>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Allocation Confirmation Modal */}
      {showDeleteAllocationModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteAllocationModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Delete Seating Arrangement</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteAllocationModal(false)}>
                ×
              </button>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete the complete seating arrangement for this examination?
              <br />
              <br />
              <strong style={{ color: '#0f172a' }}>Note:</strong> Candidates and Halls will NOT be
              deleted.
            </p>
            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setShowDeleteAllocationModal(false)}
              >
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDeleteAllocation}>
                Delete Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 6. HIDDEN B&W LANDSCAPE PRINTABLE SHEETS ==================== */}
      <div className={styles.printableContainer}>
        {/* Single Active Hall Sheet */}
        {activeHallData && activeSession && (
          <div ref={singleHallPrintRef} className={styles.printSheet}>
            <div className={styles.printCollegeHeader} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/nilogo.png" alt="College Logo" width="700" height="104.3" style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
              <h3 className={styles.printDocTitle} style={{ marginTop: '6px' }}>EXAMINATION SEATING PLAN</h3>
            </div>

            <div className={styles.printMetaGrid}>
              <div>
                <strong>Exam:</strong> {activeSession.examName}
              </div>
              <div>
                <strong>Date:</strong>{' '}
                {activeSession.examDate
                  ? new Date(activeSession.examDate).toLocaleDateString('en-GB')
                  : 'N/A'}
              </div>
              <div>
                <strong>Session:</strong> {activeSession.session}
              </div>
              <div>
                <strong>Hall No:</strong> {activeHallData.hallNumber}
              </div>
              <div>
                <strong>Total Students:</strong> {activeHallData.occupiedCount} / 25
              </div>
            </div>

            <div className={styles.printGridArea}>
              <div
                className={
                  activeHallData.layoutType === 'FOUR_BY_SIX_PLUS_ONE'
                    ? styles.printGrid4x6
                    : styles.printGrid5x5
                }
              >
                {Array.from({ length: 25 }, (_, i) => i + 1).map((seatNum) => {
                  const seatRecord = activeHallData.seats ? activeHallData.seats[seatNum] : null;

                  if (seatRecord) {
                    return (
                      <div key={seatNum} className={styles.printSeatBox}>
                        <div className={styles.printSeatNo}>{String(seatNum).padStart(2, '0')}</div>
                        <div className={styles.printRegNo}>{seatRecord.registerNo}</div>
                      </div>
                    );
                  }

                  return (
                    <div key={seatNum} className={styles.printSeatEmpty}>
                      <span className={styles.printSeatNo} style={{ color: '#64748b' }}>
                        {String(seatNum).padStart(2, '0')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.printSummaryArea}>
              <h4 className={styles.printSummaryTitle}>Subject Wise Summary:</h4>
              <table className={styles.printSummaryTable}>
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>Subject Code</th>
                    <th style={{ width: '65%' }}>Register Numbers</th>
                    <th style={{ width: '15%' }}>No. of Students</th>
                  </tr>
                </thead>
                <tbody>
                  {activeHallData.summaryList?.map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{s.subjectCode}</td>
                      <td>{s.registerRange}</td>
                      <td style={{ fontWeight: 700 }}>{s.count}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <td colSpan="2">TOTAL</td>
                    <td>{activeHallData.occupiedCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.printFooterSignatures}>
              <div>Generated On: {new Date().toLocaleString('en-GB')}</div>
              <div>Exam Cell In-charge</div>
              <div>Principal / Chief Superintendent</div>
            </div>
          </div>
        )}

        {/* All Halls Container Sheet (for Multi-hall batch export) */}
        {seatingData?.halls?.length > 0 && activeSession && (
          <div ref={allHallsContainerRef}>
            {seatingData.halls.map((hData) => (
              <div key={hData.hallId} className={styles.printSheet}>
                <div className={styles.printCollegeHeader} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/nilogo.png" alt="College Logo" width="700" height="104.3" style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
                  <h3 className={styles.printDocTitle} style={{ marginTop: '6px' }}>EXAMINATION SEATING PLAN</h3>
                </div>

                <div className={styles.printMetaGrid}>
                  <div>
                    <strong>Exam:</strong> {activeSession.examName}
                  </div>
                  <div>
                    <strong>Date:</strong>{' '}
                    {activeSession.examDate
                      ? new Date(activeSession.examDate).toLocaleDateString('en-GB')
                      : 'N/A'}
                  </div>
                  <div>
                    <strong>Session:</strong> {activeSession.session}
                  </div>
                  <div>
                    <strong>Hall No:</strong> {hData.hallNumber}
                  </div>
                  <div>
                    <strong>Total Students:</strong> {hData.occupiedCount} / 25
                  </div>
                </div>

                <div className={styles.printGridArea}>
                  <div
                    className={
                      hData.layoutType === 'FOUR_BY_SIX_PLUS_ONE'
                        ? styles.printGrid4x6
                        : styles.printGrid5x5
                    }
                  >
                    {Array.from({ length: 25 }, (_, i) => i + 1).map((seatNum) => {
                      const seatRecord = hData.seats ? hData.seats[seatNum] : null;

                      if (seatRecord) {
                        return (
                          <div key={seatNum} className={styles.printSeatBox}>
                            <div className={styles.printSeatNo}>{String(seatNum).padStart(2, '0')}</div>
                            <div className={styles.printRegNo}>{seatRecord.registerNo}</div>
                          </div>
                        );
                      }

                      return (
                        <div key={seatNum} className={styles.printSeatEmpty}>
                          <span className={styles.printSeatNo} style={{ color: '#64748b' }}>
                            {String(seatNum).padStart(2, '0')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.printSummaryArea}>
                  <h4 className={styles.printSummaryTitle}>Subject Wise Summary:</h4>
                  <table className={styles.printSummaryTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '20%' }}>Subject Code</th>
                        <th style={{ width: '65%' }}>Register Numbers</th>
                        <th style={{ width: '15%' }}>No. of Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hData.summaryList?.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{s.subjectCode}</td>
                          <td>{s.registerRange}</td>
                          <td style={{ fontWeight: 700 }}>{s.count}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                        <td colSpan="2">TOTAL</td>
                        <td>{hData.occupiedCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.printFooterSignatures}>
                  <div>Generated On: {new Date().toLocaleString('en-GB')}</div>
                  <div>Exam Cell In-charge</div>
                  <div>Principal / Chief Superintendent</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
