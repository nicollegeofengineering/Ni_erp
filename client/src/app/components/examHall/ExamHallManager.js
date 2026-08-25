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
  Layers,
  Settings,
  BookOpen,
  Sparkles,
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

// Presets for Anna University Degrees & Branches
const ANNA_UNIV_DEGREES = [
  'B.Tech',
  'B.E.',
  'M.E.',
  'M.Tech',
  'MBA',
  'MCA',
  'B.Arch',
  'M.Arch',
  'B.Sc',
  'M.Sc',
];

const ANNA_UNIV_BRANCHES = [
  'Artificial Intelligence and Data Science',
  'Computer Science and Engineering',
  'Information Technology',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biomedical Engineering',
  'Chemical Engineering',
  'Aeronautical Engineering',
  'Robotics and Automation',
  'Computer Science and Business Systems',
  'Master of Business Administration',
  'Master of Computer Applications',
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
  // Exam Masters (Configurations)
  const [masters, setMasters] = useState([]);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [editingMaster, setEditingMaster] = useState(null);
  const [masterForm, setMasterForm] = useState({
    examCode: '',
    examName: '',
    centreCode: '9460',
    centreName: 'Noorul Islam College of Engineering and Technology',
  });

  // Sessions / Schedules
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

  // 1. Range form (Default Candidate Entry)
  const [rangeForm, setRangeForm] = useState({
    programme: 'B.Tech',
    department: 'Artificial Intelligence and Data Science',
    departmentCode: 'AI&DS',
    subjectCode: '',
    subjectName: '',
    registerNoFrom: '',
    registerNoTo: '',
    defaultNamePrefix: '',
  });

  // 2. Manual rows form
  const [manualRows, setManualRows] = useState([
    {
      registerNo: '',
      name: '',
      programme: 'B.Tech',
      department: 'Artificial Intelligence and Data Science',
      subjectCode: '',
      subjectName: '',
    },
  ]);

  // Halls state
  const [halls, setHalls] = useState([]);
  const [selectedHallIds, setSelectedHallIds] = useState([]);
  const [hallSearchQuery, setHallSearchQuery] = useState('');
  const [hallLayoutFilter, setHallLayoutFilter] = useState('ALL');
  const [showAddHallForm, setShowAddHallForm] = useState(false);
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
    examMasterId: '',
    examName: '',
    examCode: '',
    centreCode: '9460',
    centreName: 'Noorul Islam College of Engineering and Technology',
    examDate: new Date().toISOString().split('T')[0],
    session: 'FN',
  });

  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [editSessionForm, setEditSessionForm] = useState({
    _id: '',
    examMasterId: '',
    examName: '',
    examCode: '',
    centreCode: '',
    centreName: '',
    examDate: '',
    session: 'FN',
  });
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false);
  const [showAllExamsModal, setShowAllExamsModal] = useState(false);

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
    () => sessions.find((s) => String(s._id) === String(selectedSessionId)) || sessions[0] || null,
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
  const fetchMasters = useCallback(async () => {
    try {
      const res = await api.get('/masters');
      if (res.data?.success) {
        setMasters(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  }, [api]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/sessions');
      if (res.data?.success) {
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
      if (res.data?.success) {
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
      const [candRes, seatRes] = await Promise.all([
        api.get(`/candidates/${selectedSessionId}`),
        api.get(`/seating/${selectedSessionId}`),
      ]);
      if (candRes.data?.success) {
        setCandidates(candRes.data.data);
      }
      if (seatRes.data?.success) {
        setSeatingData(seatRes.data);
        if (seatRes.data.halls && seatRes.data.halls.length > 0) {
          setActiveHallViewId(seatRes.data.halls[0].hallId);
        }
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
    }
  }, [api, selectedSessionId]);

  // Initial load
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessRes, hallsRes, mastersRes] = await Promise.all([
          api.get('/sessions'),
          api.get('/halls'),
          api.get('/masters'),
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
          if (mastersRes.data?.success) {
            setMasters(mastersRes.data.data);
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

  // Load session candidates/seating when session selection changes
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

  // ---------- Exam Master Handlers ----------
  const handleSaveMaster = async (e) => {
    e.preventDefault();
    try {
      if (editingMaster) {
        const res = await api.put(`/masters/${editingMaster._id}`, masterForm);
        if (res.data.success) {
          showAlert('success', 'Exam Master updated successfully.');
          setEditingMaster(null);
          setShowMasterModal(false);
          await fetchMasters();
          await fetchSessions();
        }
      } else {
        const res = await api.post('/masters', masterForm);
        if (res.data.success) {
          showAlert('success', 'Exam Master created successfully.');
          setShowMasterModal(false);
          setMasterForm({
            examCode: '',
            examName: '',
            centreCode: '9460',
            centreName: 'Nagercoil Islam College of Engineering and Technology',
          });
          await fetchMasters();
        }
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to save Exam Master.');
    }
  };

  const handleDeleteMaster = async (masterId) => {
    try {
      const res = await api.delete(`/masters/${masterId}`);
      if (res.data.success) {
        showAlert('success', 'Exam Master deleted successfully.');
        await fetchMasters();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete Exam Master.');
    }
  };

  // ---------- Session Handlers ----------
  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/sessions', sessionForm);
      if (res.data.success) {
        showAlert('success', 'Exam Session created successfully.');
        setShowSessionModal(false);
        setSessionForm({
          examMasterId: '',
          examName: '',
          examCode: '',
          centreCode: '9460',
          centreName: 'Noorul Islam College of Engineering and Technology',
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

  const openEditSession = (sess) => {
    if (!sess) return;
    const dStr = sess.examDate ? new Date(sess.examDate).toISOString().split('T')[0] : '';
    setEditSessionForm({
      _id: sess._id,
      examMasterId: sess.examMaster?._id || sess.examMaster || '',
      examName: sess.examName || '',
      examCode: sess.examCode || '',
      centreCode: sess.centreCode || '9460',
      centreName: sess.centreName || 'Nagercoil Islam College of Engineering and Technology',
      examDate: dStr,
      session: sess.session || 'FN',
    });
    setShowEditSessionModal(true);
  };

  const handleUpdateSession = async (e) => {
    e.preventDefault();
    if (!editSessionForm._id) return;
    try {
      const res = await api.put(`/sessions/${editSessionForm._id}`, editSessionForm);
      if (res.data.success) {
        showAlert('success', 'Exam session updated successfully.');
        setShowEditSessionModal(false);
        await fetchSessions();
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to update exam session.');
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId) return;
    try {
      const res = await api.delete(`/sessions/${selectedSessionId}`);
      if (res.data.success) {
        showAlert('success', 'Exam session and all associated candidates/seating deleted successfully.');
        setShowDeleteSessionModal(false);
        setSelectedSessionId('');
        setCandidates([]);
        setSeatingData(null);
        await fetchSessions();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete exam session.');
    }
  };

  // ---------- Candidate Handlers ----------
  // 1. Add via Range (Degree + Branch + Subject Code + Name + Reg Range)
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
        setRangeForm((prev) => ({
          ...prev,
          registerNoFrom: '',
          registerNoTo: '',
          defaultNamePrefix: '',
        }));
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to add range candidates.');
    }
  };

  // 2. Add via Manual Rows
  const handleAddManualRow = () => {
    const lastRow = manualRows[manualRows.length - 1] || {};
    setManualRows((prev) => [
      ...prev,
      {
        registerNo: '',
        name: '',
        programme: lastRow.programme || 'B.Tech',
        department: lastRow.department || 'Artificial Intelligence and Data Science',
        subjectCode: lastRow.subjectCode || '',
        subjectName: lastRow.subjectName || '',
      },
    ]);
  };

  const handleRemoveManualRow = (idx) => {
    if (manualRows.length === 1) return;
    setManualRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleManualRowChange = (idx, field, value) => {
    setManualRows((prev) => {
      const copy = [...prev];
      copy[idx][field] = value;
      return copy;
    });
  };

  const handleSaveManualCandidates = async (e) => {
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
        setManualRows([
          {
            registerNo: '',
            name: '',
            programme: 'B.Tech',
            department: 'Artificial Intelligence and Data Science',
            subjectCode: '',
            subjectName: '',
          },
        ]);
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to save manual candidates.');
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

  const handleDeleteCandidate = async (id) => {
    try {
      const res = await api.delete(`/candidates/${id}`);
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
        showAlert('success', 'Hall added successfully.');
        setHallForm({ hallNumber: '', layoutType: 'FIVE_BY_FIVE' });
        await fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to add hall.');
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

  const handleDeleteHall = async (id) => {
    try {
      const res = await api.delete(`/halls/${id}`);
      if (res.data.success) {
        showAlert('success', 'Hall deleted successfully.');
        await fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete hall.');
    }
  };

  const handleToggleHallSelection = (hallId) => {
    setSelectedHallIds((prev) =>
      prev.includes(hallId) ? prev.filter((id) => id !== hallId) : [...prev, hallId]
    );
  };

  // Filtered halls list
  const filteredHalls = useMemo(() => {
    return halls.filter((h) => {
      const matchesSearch =
        !hallSearchQuery.trim() ||
        h.hallNumber.toLowerCase().includes(hallSearchQuery.trim().toLowerCase());
      const matchesLayout = hallLayoutFilter === 'ALL' || h.layoutType === hallLayoutFilter;
      return matchesSearch && matchesLayout;
    });
  }, [halls, hallSearchQuery, hallLayoutFilter]);

  const handleSelectAllFilteredHalls = () => {
    const allFilteredIds = filteredHalls.map((h) => h._id);
    setSelectedHallIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleDeselectAllHalls = () => {
    setSelectedHallIds([]);
  };

  const handleSmartAutoSelectHalls = () => {
    if (candidates.length === 0) {
      showAlert('error', 'No candidates registered yet. Please add candidates first.');
      return;
    }
    const neededHallsCount = Math.ceil(candidates.length / 25);
    const activeHalls = halls.filter((h) => h.active);
    if (activeHalls.length < neededHallsCount) {
      showAlert(
        'error',
        `Not enough active halls in ERP (${activeHalls.length} halls available vs ${neededHallsCount} needed for ${candidates.length} candidates). Please add more halls.`
      );
      setSelectedHallIds(activeHalls.map((h) => h._id));
      return;
    }
    const optimalHalls = activeHalls.slice(0, neededHallsCount).map((h) => h._id);
    setSelectedHallIds(optimalHalls);
    showAlert(
      'success',
      `Smart Auto-Selected ${neededHallsCount} halls (${neededHallsCount * 25} capacity) for ${candidates.length} candidates.`
    );
  };

  // ---------- Allocation Handlers ----------
  const totalSelectedCapacity = selectedHallIds.length * 25;
  const isCapacitySufficient = totalSelectedCapacity >= candidates.length;

  const handleGenerateAllocation = async () => {
    if (!selectedSessionId) {
      showAlert('error', 'Please select an Exam Session.');
      return;
    }
    if (selectedHallIds.length === 0) {
      showAlert('error', 'Please select at least one Exam Hall.');
      return;
    }
    if (candidates.length === 0) {
      showAlert('error', 'Please add candidates for this exam date & session before generating seating allocation.');
      return;
    }
    if (!isCapacitySufficient) {
      showAlert(
        'error',
        `Selected halls do not have sufficient seating capacity. (${candidates.length} candidates vs ${totalSelectedCapacity} capacity)`
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
      showAlert('error', err.response?.data?.message || 'Failed to generate allocation.');
    } finally {
      setAllocating(false);
    }
  };

  const handleRegenerateAllocation = async () => {
    setShowRegenerateModal(false);
    await handleGenerateAllocation();
  };

  const handleDeleteAllocation = async () => {
    if (!selectedSessionId) return;
    try {
      const res = await api.delete(`/allocation/${selectedSessionId}`);
      if (res.data.success) {
        showAlert('success', res.data.message);
        setShowDeleteAllocationModal(false);
        await fetchSessions();
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete allocation.');
    }
  };

  // ---------- Candidate Seat Quick Search ----------
  const handleSearchCandidate = async (e) => {
    e.preventDefault();
    if (!searchRegNo.trim()) return;
    try {
      setSearchLoading(true);
      const res = await api.get(
        `/search?registerNo=${encodeURIComponent(searchRegNo.trim())}&sessionId=${selectedSessionId || ''}`
      );
      if (res.data.success) {
        setSearchResult(res.data.data);
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Candidate seating not found.');
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  // ---------- PDF Export Handlers (Anna University Format) ----------
  const activeHallData = useMemo(() => {
    if (!seatingData || !seatingData.halls || seatingData.halls.length === 0) return null;
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
      showAlert('success', 'Official Anna University Landscape PDF downloaded successfully.');
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
        c.subjectCode.toLowerCase().includes(q) ||
        (c.department && c.department.toLowerCase().includes(q)) ||
        (c.programme && c.programme.toLowerCase().includes(q))
    );
  }, [candidates, candidateSearch]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Exam Hall Allocation</h1>
          <p>Autonomous Examination Seating &amp; Candidate Allocation Engine (Anna University Format)</p>
        </div>

        <div className={styles.sessionSelectorArea}>
          <div className={styles.sessionSelectRow}>
            <select
              className={styles.sessionSelect}
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              {sessions.length === 0 ? (
                <option value="">No Exam Schedules Found</option>
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

          <div className={styles.sessionButtonsRow}>
            {sessions.length > 0 && (
              <>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => openEditSession(activeSession || sessions[0])}
                  title="Edit Exam Name & Details"
                >
                  <Edit2 size={14} /> Edit Exam
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => setShowDeleteSessionModal(true)}
                  title="Delete Exam"
                >
                  <Trash2 size={14} /> Delete Exam
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setShowAllExamsModal(true)}
                  title="View All Exam Schedules"
                >
                  <Calendar size={14} /> All Schedules ({sessions.length})
                </button>
              </>
            )}

            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => {
                setEditingMaster(null);
                setMasterForm({
                  examCode: '',
                  examName: '',
                  centreCode: '9460',
                  centreName: 'Nagercoil Islam College of Engineering and Technology',
                });
                setShowMasterModal(true);
              }}
              title="Configure Reusable Exam Master Settings"
            >
              <Settings size={14} /> Exam Masters
            </button>

            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowSessionModal(true)}>
              <Plus size={15} /> New Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {alert.message && (
        <div
          className={`${styles.alert} ${alert.type === 'success' ? styles.alertSuccess : styles.alertError
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
            <Users size={20} /> 1. Candidate Entry (Internal &amp; External Candidates)
          </h2>
          <span className={`${styles.badge} ${styles.badgeDraft}`}>
            Total Registered: {candidates.length}
          </span>
        </div>

        {/* Active Exam Overview Banner */}
        {activeSession && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Examination Schedule:{' '}
              </span>
              <strong style={{ fontSize: '15px', color: '#0f172a', marginRight: '8px' }}>
                {activeSession.examName}
              </strong>
              <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                Centre: {activeSession.centreCode || '9460'} – {activeSession.centreName || 'Nagercoil Islam College of Engineering and Technology'}
              </span>
              <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                Date: {activeSession.examDate ? new Date(activeSession.examDate).toLocaleDateString('en-GB') : 'N/A'}
              </span>
              <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '13px', color: '#475569' }}>Session: {activeSession.session}</span>
              <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span>
              <span
                className={`${styles.badge} ${activeSession.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft
                  }`}
              >
                {activeSession.status}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                onClick={() => openEditSession(activeSession)}
                title="Edit Exam Name & Date"
              >
                <Edit2 size={13} /> Edit
              </button>
              <button
                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                onClick={() => setShowDeleteSessionModal(true)}
                title="Delete Exam"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        )}

        <div className={styles.tabsNav}>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'range' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('range')}
          >
            A. Register Range Entry (Batch)
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'manual' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('manual')}
          >
            B. Manual Candidate Entry Rows
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'list' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('list')}
          >
            Candidate List ({candidates.length})
          </button>
        </div>

        {/* Tab 1: Range Entry (With Degree & Branch presets) */}
        {candidateTab === 'range' && (
          <form onSubmit={handleAddRangeCandidates}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b' }}>
                <BookOpen size={15} style={{ display: 'inline', marginRight: '6px' }} /> Academic &amp; Subject Details
              </h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Degree (Programme) *</label>
                  <select
                    className={styles.select}
                    value={rangeForm.programme}
                    onChange={(e) => setRangeForm({ ...rangeForm, programme: e.target.value })}
                  >
                    {ANNA_UNIV_DEGREES.map((deg) => (
                      <option key={deg} value={deg}>
                        {deg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Branch / Department *</label>
                  <input
                    list="branch-suggestions"
                    className={styles.input}
                    placeholder="Type or pick Branch Name"
                    value={rangeForm.department}
                    onChange={(e) => setRangeForm({ ...rangeForm, department: e.target.value })}
                    required
                  />
                  <datalist id="branch-suggestions">
                    {ANNA_UNIV_BRANCHES.map((br) => (
                      <option key={br} value={br} />
                    ))}
                  </datalist>
                </div>

                <div className={styles.formGroup}>
                  <label>Subject Code *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. MA3391 or PH25C01"
                    value={rangeForm.subjectCode}
                    onChange={(e) => setRangeForm({ ...rangeForm, subjectCode: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Subject Name</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Transforms and Partial Differential Equations"
                    value={rangeForm.subjectName}
                    onChange={(e) => setRangeForm({ ...rangeForm, subjectName: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e3a8a' }}>
                Register Number Range (Any Alphanumeric Format)
              </h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Register No From *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 946023AIDS001 or 23ABC001"
                    value={rangeForm.registerNoFrom}
                    onChange={(e) => setRangeForm({ ...rangeForm, registerNoFrom: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Register No To *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 946023AIDS025 or 23ABC025"
                    value={rangeForm.registerNoTo}
                    onChange={(e) => setRangeForm({ ...rangeForm, registerNoTo: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Candidate Name Prefix (Optional)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Candidate"
                    value={rangeForm.defaultNamePrefix}
                    onChange={(e) => setRangeForm({ ...rangeForm, defaultNamePrefix: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={16} /> Save Range Candidates
            </button>
          </form>
        )}

        {/* Tab 2: Manual Entry Rows */}
        {candidateTab === 'manual' && (
          <form onSubmit={handleSaveManualCandidates}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Register No *</th>
                    <th>Name</th>
                    <th>Degree *</th>
                    <th>Branch / Department *</th>
                    <th>Subject Code *</th>
                    <th>Subject Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ width: '30px' }}>{idx + 1}</td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="e.g. 946023CSE001"
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
                        <select
                          className={styles.select}
                          value={row.programme}
                          onChange={(e) => handleManualRowChange(idx, 'programme', e.target.value)}
                        >
                          {ANNA_UNIV_DEGREES.map((deg) => (
                            <option key={deg} value={deg}>
                              {deg}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          list="branch-suggestions-manual"
                          className={styles.input}
                          placeholder="e.g. Computer Science and Engineering"
                          value={row.department}
                          onChange={(e) => handleManualRowChange(idx, 'department', e.target.value)}
                          required
                        />
                        <datalist id="branch-suggestions-manual">
                          {ANNA_UNIV_BRANCHES.map((br) => (
                            <option key={br} value={br} />
                          ))}
                        </datalist>
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="e.g. MA3391"
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
                          disabled={manualRows.length === 1}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={handleAddManualRow}
              >
                <Plus size={15} /> Add Another Row
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                <CheckCircle size={15} /> Save Candidates
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Candidate List */}
        {candidateTab === 'list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ width: '340px' }}>
                <input
                  className={styles.input}
                  placeholder="Search by Reg No, Name, Subject, Branch..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                />
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', alignSelf: 'center' }}>
                Showing {filteredCandidates.length} of {candidates.length} candidates
              </div>
            </div>

            <div className={styles.tableWrapper} style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Register No</th>
                    <th>Candidate Name</th>
                    <th>Degree &amp; Branch</th>
                    <th>Subject Code</th>
                    <th>Subject Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No candidates registered for this exam session.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((cand, idx) => (
                      <tr key={cand._id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 700 }}>{cand.registerNo}</td>
                        <td>{cand.name}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{cand.programme || 'B.Tech'}</span> {cand.department || cand.departmentCode || '-'}
                        </td>
                        <td>
                          <span className={styles.pillBadge}>{cand.subjectCode}</span>
                        </td>
                        <td>{cand.subjectName || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                              onClick={() => setEditingCandidate(cand)}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                              onClick={() => handleDeleteCandidate(cand._id)}
                            >
                              <Trash2 size={12} />
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

      {/* ==================== 2. HALL SELECTION & CAPACITY ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Building2 size={20} /> 2. Exam Hall Selection &amp; Capacity Planner
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`${styles.badge} ${styles.badgeDraft}`}>
              {halls.length} Total Halls
            </span>
            <span className={`${styles.badge} ${isCapacitySufficient ? styles.badgeAllocated : styles.badgeWarning}`}>
              {selectedHallIds.length} Selected ({totalSelectedCapacity} Seats)
            </span>
          </div>
        </div>

        {/* Real-time Interactive Capacity Visualizer Bar */}
        <div className={styles.capacityBarContainer}>
          <div className={styles.capacityBarTop}>
            <div className={styles.capacityBarStats}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  REGISTERED CANDIDATES
                </span>
                <strong style={{ fontSize: '18px', color: '#0f172a' }}>{candidates.length}</strong>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '20px' }}>/</div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  SELECTED HALL CAPACITY
                </span>
                <strong style={{ fontSize: '18px', color: '#2563eb' }}>
                  {totalSelectedCapacity} Seats ({selectedHallIds.length} Halls)
                </strong>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '20px' }}>•</div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  CAPACITY STATUS
                </span>
                {candidates.length === 0 ? (
                  <span style={{ color: '#64748b', fontSize: '13.5px', fontWeight: 600 }}>0 Candidates</span>
                ) : isCapacitySufficient ? (
                  <span style={{ color: '#16a34a', fontSize: '13.5px', fontWeight: 700 }}>
                    ✓ Sufficient (+{totalSelectedCapacity - candidates.length} Extra Seats)
                  </span>
                ) : (
                  <span style={{ color: '#dc2626', fontSize: '13.5px', fontWeight: 700 }}>
                    ⚠️ Need {candidates.length - totalSelectedCapacity} More Seats
                  </span>
                )}
              </div>
            </div>

            <div className={styles.hallQuickButtons}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                onClick={handleSmartAutoSelectHalls}
                title="Automatically select the exact optimal number of halls required"
              >
                <Sparkles size={13} /> Smart Auto-Select
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                onClick={handleSelectAllFilteredHalls}
              >
                Select All
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                onClick={handleDeselectAllHalls}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className={styles.capacityProgressTrack}>
            <div
              className={`${styles.capacityProgressFill} ${isCapacitySufficient ? styles.capacityProgressSufficient : styles.capacityProgressDeficit
                }`}
              style={{
                width: `${totalSelectedCapacity > 0
                  ? Math.min(100, Math.round((candidates.length / totalSelectedCapacity) * 100))
                  : 0
                  }%`,
              }}
            />
          </div>
        </div>

        {/* Hall Controls & Filter Row */}
        <div className={styles.hallControlsRow}>
          <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
            <input
              className={`${styles.input} ${styles.hallSearchInput}`}
              placeholder="Search Hall Number (e.g. D401)..."
              value={hallSearchQuery}
              onChange={(e) => setHallSearchQuery(e.target.value)}
            />
            <select
              className={styles.select}
              value={hallLayoutFilter}
              onChange={(e) => setHallLayoutFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="ALL">All Layouts</option>
              <option value="FIVE_BY_FIVE">5 × 5 Grid (25 Seats)</option>
              <option value="FOUR_BY_SIX_PLUS_ONE">4 × 6 + 1 Grid (25 Seats)</option>
            </select>
          </div>

          <button
            type="button"
            className={`${styles.btn} ${showAddHallForm ? styles.btnOutline : styles.btnPrimary} ${styles.btnSmall}`}
            onClick={() => setShowAddHallForm(!showAddHallForm)}
          >
            {showAddHallForm ? 'Hide Form' : '+ Add New Exam Hall'}
          </button>
        </div>

        {/* Add New Hall Card Form (when expanded) */}
        {showAddHallForm && (
          <form onSubmit={handleCreateHall} className={styles.addHallCard} style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>
              Create New Examination Hall (Capacity: 25 Seats)
            </h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className={styles.formGroup} style={{ flex: '1 1 200px' }}>
                <label>Hall Number *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. D401B or HALL-12"
                  value={hallForm.hallNumber}
                  onChange={(e) => setHallForm({ ...hallForm, hallNumber: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ flex: '1 1 220px' }}>
                <label>Physical Layout Type *</label>
                <select
                  className={styles.select}
                  value={hallForm.layoutType}
                  onChange={(e) => setHallForm({ ...hallForm, layoutType: e.target.value })}
                >
                  <option value="FIVE_BY_FIVE">5 × 5 Grid (25 Seats)</option>
                  <option value="FOUR_BY_SIX_PLUS_ONE">4 × 6 + 1 Grid (25 Seats)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  <Plus size={15} /> Save Hall
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setShowAddHallForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Interactive Hall Cards Grid */}
        <div className={styles.hallGrid}>
          {filteredHalls.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', color: '#64748b' }}>
              No examination halls match the filter criteria.
            </div>
          ) : (
            filteredHalls.map((hall) => {
              const isSelected = selectedHallIds.includes(hall._id);
              return (
                <div
                  key={hall._id}
                  className={`${styles.hallCard} ${isSelected ? styles.hallCardSelected : ''}`}
                  onClick={() => handleToggleHallSelection(hall._id)}
                >
                  <div>
                    <div className={styles.hallCardHeader}>
                      <div className={styles.hallIconBadge}>
                        <Building2 size={18} />
                      </div>
                      <span className={styles.hallNumber}>{hall.hallNumber}</span>
                      <input
                        type="checkbox"
                        className={styles.hallCheckbox}
                        checked={isSelected}
                        onChange={() => handleToggleHallSelection(hall._id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className={styles.hallDetailsBody}>
                      <span className={styles.hallCapacityTag}>
                        <Users size={12} /> 25 Seats
                      </span>
                      <span className={styles.hallLayoutTag}>
                        <Grid size={11} /> {hall.layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? '4 × 6 + 1' : '5 × 5'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.hallCardFooter} onClick={(e) => e.stopPropagation()}>
                    <span className={styles.hallStatusIndicator}>
                      <CheckCircle size={12} /> {isSelected ? 'Included' : 'Available'}
                    </span>
                    <div className={styles.hallCardActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                        onClick={() => setEditingHall(hall)}
                        title="Edit Hall Details"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => handleDeleteHall(hall._id)}
                        title="Delete Hall"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ==================== 3. ALLOCATION METRICS & GENERATION ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Layers size={20} /> 3. Seating Allocation for {activeSession?.examDate ? new Date(activeSession.examDate).toLocaleDateString('en-GB') : 'Selected Date'} ({activeSession?.session || 'FN'})
          </h2>
          <span
            className={`${styles.badge} ${activeSession?.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft
              }`}
          >
            Status: {activeSession?.status || 'DRAFT'}
          </span>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricBox}>
            <div className={styles.metricValue}>{candidates.length}</div>
            <div className={styles.metricLabel}>Total Registered Students</div>
          </div>
          <div className={styles.metricBox}>
            <div className={styles.metricValue}>{totalSelectedCapacity}</div>
            <div className={styles.metricLabel}>Selected Hall Capacity ({selectedHallIds.length} Halls)</div>
          </div>
          <div className={styles.metricBox}>
            <div
              className={styles.metricValue}
              style={{ color: isCapacitySufficient ? '#16a34a' : '#dc2626' }}
            >
              {isCapacitySufficient
                ? totalSelectedCapacity - candidates.length
                : `Deficit (${candidates.length - totalSelectedCapacity})`}
            </div>
            <div className={styles.metricLabel}>Remaining Capacity</div>
          </div>
        </div>

        {!isCapacitySufficient && (
          <div className={`${styles.alert} ${styles.alertError}`} style={{ marginBottom: '16px' }}>
            <span>
              ⚠️ Selected halls do not have sufficient seating capacity. Total Candidates ({candidates.length}) exceed Selected Capacity ({totalSelectedCapacity}). Please select or add more halls.
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
              <CheckCircle size={16} /> {allocating ? 'Allocating…' : 'Generate Seat Allocation'}
            </button>
          )}
        </div>
      </section>

      {/* ==================== 4. COLORFUL HALL VIEW & OFFICIAL SUMMARY ==================== */}
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
              const isActive = h.hallId === (activeHallData?.hallId || '');
              return (
                <button
                  key={h.hallId}
                  className={`${styles.hallTab} ${isActive ? styles.hallTabActive : ''}`}
                  onClick={() => setActiveHallViewId(h.hallId)}
                >
                  <strong>{h.hallNumber}</strong>
                  <span>({h.occupiedCount} / 25)</span>
                </button>
              );
            })}
          </div>

          {activeHallData && (
            <div className={styles.seatingContainer}>
              <div
                className={`${styles.seatingGrid} ${activeHallData.layoutType === 'FOUR_BY_SIX_PLUS_ONE'
                  ? styles.grid4x6
                  : styles.grid5x5
                  }`}
              >
                {Array.from({ length: 25 }, (_, i) => i + 1).map((seatNum) => {
                  const seatRecord = activeHallData.seats ? activeHallData.seats[seatNum] : null;

                  if (seatRecord) {
                    const colorClass = subjectColorMap[(seatRecord.subjectCode || '').toUpperCase()] || '';
                    return (
                      <div key={seatNum} className={`${styles.seatBox} ${styles.seatOccupied} ${colorClass}`}>
                        <div className={styles.seatNumberBadge}>
                          Seat {String(seatNum).padStart(2, '0')}
                        </div>
                        <div className={styles.seatCandidateReg}>{seatRecord.registerNo}</div>
                        <div className={styles.seatSubjectBadge}>{seatRecord.subjectCode}</div>
                      </div>
                    );
                  }

                  return (
                    <div key={seatNum} className={`${styles.seatBox} ${styles.seatEmpty}`}>
                      <div className={styles.seatNumberBadge} style={{ color: '#94a3b8' }}>
                        Seat {String(seatNum).padStart(2, '0')}
                      </div>
                      <div style={{ height: '24px' }} />
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Anna University Degree & Branch Summary Table */}
              <div style={{ width: '100%', maxWidth: '1000px', marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e293b' }}>
                  Hall {activeHallData.hallNumber} - Degree &amp; Branch Seating Summary:
                </h4>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Hall No</th>
                        <th>Degree &amp; Branch</th>
                        <th>Subject Code</th>
                        <th>Register Numbers</th>
                        <th style={{ textAlign: 'center' }}>No of Candidates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeHallData.summaryList?.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{activeHallData.hallNumber}</td>
                          <td>
                            <span
                              className={
                                s.degreeBranch === 'Common Sub'
                                  ? `${styles.badge} ${styles.badgeDraft}`
                                  : ''
                              }
                              style={{ fontWeight: 600 }}
                            >
                              {s.degreeBranch}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{s.subjectCode}</td>
                          <td style={{ fontSize: '12px', maxWidth: '420px', wordBreak: 'break-word' }}>
                            {s.registerNumbers}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>{s.count}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                        <td colSpan="4" style={{ textAlign: 'right' }}>TOTAL</td>
                        <td style={{ textAlign: 'center' }}>{activeHallData.occupiedCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ==================== 5. QUICK CANDIDATE SEAT SEARCH ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Search size={20} /> 5. Candidate Seat Quick Search
          </h2>
        </div>

        <form onSubmit={handleSearchCandidate} className={styles.searchBar}>
          <input
            className={styles.input}
            placeholder="Enter Student Register Number (e.g. 946023AIDS001)"
            value={searchRegNo}
            onChange={(e) => setSearchRegNo(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={searchLoading}>
            <Search size={15} /> {searchLoading ? 'Searching...' : 'Search Candidate'}
          </button>
        </form>

        {searchResult && (
          <div className={styles.searchResultBox}>
            <h4 style={{ margin: '0 0 10px 0', color: '#166534', fontSize: '15px' }}>
              Candidate Allocated Successfully
            </h4>
            <div className={styles.searchResultGrid}>
              <div>
                <strong>Candidate:</strong> {searchResult.name} ({searchResult.registerNo})
              </div>
              <div>
                <strong>Degree &amp; Branch:</strong> {searchResult.programme || 'B.Tech'} {searchResult.department || searchResult.departmentCode || '-'}
              </div>
              <div>
                <strong>Subject:</strong> {searchResult.subjectCode} {searchResult.subjectName ? `(${searchResult.subjectName})` : ''}
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
            </div>
          </div>
        )}
      </section>

      {/* ==================== MODALS ==================== */}

      {/* Exam Master Setup Modal */}
      {showMasterModal && (
        <div className={styles.modalOverlay} onClick={() => setShowMasterModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '780px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingMaster ? 'Edit Exam Master' : 'Exam Master Configuration'}</h3>
              <button className={styles.modalClose} onClick={() => setShowMasterModal(false)}>
                ×
              </button>
            </div>

            {/* Master Form */}
            <form onSubmit={handleSaveMaster} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a' }}>
                {editingMaster ? 'Update Configuration' : 'Create New Exam Configuration (e.g. Anna University)'}
              </h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Exam Code (Unique Identifier) *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. AU-ND-2026"
                    value={masterForm.examCode}
                    onChange={(e) => setMasterForm({ ...masterForm, examCode: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Centre Code *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 9460"
                    value={masterForm.centreCode}
                    onChange={(e) => setMasterForm({ ...masterForm, centreCode: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Examination Name (Primary PDF Heading) *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026"
                    value={masterForm.examName}
                    onChange={(e) => setMasterForm({ ...masterForm, examName: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Centre Name *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Nagercoil Islam College of Engineering and Technology"
                    value={masterForm.centreName}
                    onChange={(e) => setMasterForm({ ...masterForm, centreName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  {editingMaster ? 'Update Master' : 'Save Master Configuration'}
                </button>
                {editingMaster && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnOutline}`}
                    onClick={() => {
                      setEditingMaster(null);
                      setMasterForm({
                        examCode: '',
                        examName: '',
                        centreCode: '9460',
                        centreName: 'Nagercoil Islam College of Engineering and Technology',
                      });
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>

            {/* Masters Table */}
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: '#475569' }}>Existing Exam Masters</h4>
            <div className={styles.tableWrapper} style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Exam Name</th>
                    <th>Centre Code &amp; Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                        No exam masters configured yet.
                      </td>
                    </tr>
                  ) : (
                    masters.map((m) => (
                      <tr key={m._id}>
                        <td style={{ fontWeight: 700 }}>{m.examCode}</td>
                        <td>{m.examName}</td>
                        <td>{m.centreCode} - {m.centreName}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                              onClick={() => {
                                setEditingMaster(m);
                                setMasterForm({
                                  examCode: m.examCode,
                                  examName: m.examName,
                                  centreCode: m.centreCode || '9460',
                                  centreName: m.centreName || 'Nagercoil Islam College of Engineering and Technology',
                                });
                              }}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                              onClick={() => handleDeleteMaster(m._id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.modalActions} style={{ marginTop: '16px' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setShowMasterModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showSessionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSessionModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create New Exam Schedule</h3>
              <button className={styles.modalClose} onClick={() => setShowSessionModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateSession}>
              {masters.length > 0 && (
                <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
                  <label>Select Exam Master (Optional)</label>
                  <select
                    className={styles.select}
                    value={sessionForm.examMasterId}
                    onChange={(e) => {
                      const mId = e.target.value;
                      const selectedM = masters.find((m) => m._id === mId);
                      if (selectedM) {
                        setSessionForm({
                          ...sessionForm,
                          examMasterId: mId,
                          examName: selectedM.examName,
                          examCode: selectedM.examCode,
                          centreCode: selectedM.centreCode,
                          centreName: selectedM.centreName,
                        });
                      } else {
                        setSessionForm({ ...sessionForm, examMasterId: '' });
                      }
                    }}
                  >
                    <option value="">Custom Examination</option>
                    {masters.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.examCode} - {m.examName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
                <label>Exam Name (Primary PDF Header) *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026"
                  value={sessionForm.examName}
                  onChange={(e) => setSessionForm({ ...sessionForm, examName: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGrid} style={{ marginBottom: '14px' }}>
                <div className={styles.formGroup}>
                  <label>Centre Code</label>
                  <input
                    className={styles.input}
                    value={sessionForm.centreCode}
                    onChange={(e) => setSessionForm({ ...sessionForm, centreCode: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Centre Name</label>
                  <input
                    className={styles.input}
                    value={sessionForm.centreName}
                    onChange={(e) => setSessionForm({ ...sessionForm, centreName: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGrid} style={{ marginBottom: '20px' }}>
                <div className={styles.formGroup}>
                  <label>Exam Date *</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={sessionForm.examDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, examDate: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
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
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditSessionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditSessionModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Exam Schedule</h3>
              <button className={styles.modalClose} onClick={() => setShowEditSessionModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateSession}>
              <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
                <label>Exam Name (Primary PDF Header) *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026"
                  value={editSessionForm.examName}
                  onChange={(e) => setEditSessionForm({ ...editSessionForm, examName: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGrid} style={{ marginBottom: '14px' }}>
                <div className={styles.formGroup}>
                  <label>Centre Code</label>
                  <input
                    className={styles.input}
                    value={editSessionForm.centreCode}
                    onChange={(e) => setEditSessionForm({ ...editSessionForm, centreCode: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Centre Name</label>
                  <input
                    className={styles.input}
                    value={editSessionForm.centreName}
                    onChange={(e) => setEditSessionForm({ ...editSessionForm, centreName: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGrid} style={{ marginBottom: '20px' }}>
                <div className={styles.formGroup}>
                  <label>Exam Date *</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={editSessionForm.examDate}
                    onChange={(e) => setEditSessionForm({ ...editSessionForm, examDate: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Session *</label>
                  <select
                    className={styles.select}
                    value={editSessionForm.session}
                    onChange={(e) => setEditSessionForm({ ...editSessionForm, session: e.target.value })}
                  >
                    <option value="FN">FN (Forenoon / Morning)</option>
                    <option value="AN">AN (Afternoon)</option>
                  </select>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setShowEditSessionModal(false)}
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

      {/* Delete Exam Session Confirmation Modal */}
      {showDeleteSessionModal && activeSession && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteSessionModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Delete Exam Session</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteSessionModal(false)}>
                ×
              </button>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
              Are you sure you want to delete the examination schedule{' '}
              <strong style={{ color: '#0f172a' }}>&ldquo;{activeSession.examName}&rdquo;</strong>?
              <br />
              <br />
              <strong style={{ color: '#dc2626' }}>Warning:</strong> This will permanently delete this
              exam schedule, all candidate enrollments in it, and any existing seating allocations.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setShowDeleteSessionModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleDeleteSession}
              >
                Delete Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Exam Sessions List & Management Modal */}
      {showAllExamsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAllExamsModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '840px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>All Exam Schedules ({sessions.length})</h3>
              <button className={styles.modalClose} onClick={() => setShowAllExamsModal(false)}>
                ×
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', marginBottom: '16px' }}>
              {sessions.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No exam schedules found.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Exam Name</th>
                      <th>Date</th>
                      <th>Session</th>
                      <th>Status</th>
                      <th>Candidates</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((sess) => {
                      const isCurrent = sess._id === selectedSessionId;
                      return (
                        <tr key={sess._id} style={isCurrent ? { background: '#f0fdf4' } : {}}>
                          <td style={{ fontWeight: 600 }}>
                            {sess.examName}
                            {isCurrent && (
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                                (Active)
                              </span>
                            )}
                          </td>
                          <td>
                            {sess.examDate ? new Date(sess.examDate).toLocaleDateString('en-GB') : 'N/A'}
                          </td>
                          <td>
                            <span className={styles.pillBadge}>{sess.session}</span>
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${sess.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft
                                }`}
                            >
                              {sess.status}
                            </span>
                          </td>
                          <td>{sess.candidateCount || 0}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {!isCurrent ? (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                                  onClick={() => {
                                    setSelectedSessionId(sess._id);
                                    setShowAllExamsModal(false);
                                  }}
                                  title="Select this Exam"
                                >
                                  Select
                                </button>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, padding: '4px 8px' }}>
                                  Selected
                                </span>
                              )}
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                                onClick={() => {
                                  setShowAllExamsModal(false);
                                  openEditSession(sess);
                                }}
                                title="Edit Exam Schedule"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                                onClick={() => {
                                  setSelectedSessionId(sess._id);
                                  setShowAllExamsModal(false);
                                  setShowDeleteSessionModal(true);
                                }}
                                title="Delete Exam"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setShowAllExamsModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  setShowAllExamsModal(false);
                  setShowSessionModal(true);
                }}
              >
                <Plus size={15} /> Create New Schedule
              </button>
            </div>
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
              <div className={styles.formGrid} style={{ marginBottom: '12px' }}>
                <div className={styles.formGroup}>
                  <label>Degree (Programme) *</label>
                  <select
                    className={styles.select}
                    value={editingCandidate.programme || 'B.Tech'}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, programme: e.target.value })}
                  >
                    {ANNA_UNIV_DEGREES.map((deg) => (
                      <option key={deg} value={deg}>
                        {deg}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Branch / Department *</label>
                  <input
                    list="branch-suggestions-edit"
                    className={styles.input}
                    value={editingCandidate.department || ''}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, department: e.target.value })}
                    required
                  />
                  <datalist id="branch-suggestions-edit">
                    {ANNA_UNIV_BRANCHES.map((br) => (
                      <option key={br} value={br} />
                    ))}
                  </datalist>
                </div>
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
              seating arrangement across all selected halls for this date and session.
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

      {/* ==================== 6. HIDDEN OFFICIAL ANNA UNIVERSITY FORMAT PRINTABLE SHEETS ==================== */}
      <div className={styles.printableContainer}>
        {/* Single Active Hall Sheet */}
        {activeHallData && activeSession && (
          <div ref={singleHallPrintRef} className={styles.printSheet}>
            <div className={styles.printCollegeHeader}>
              <h2 className={styles.printExamHeading}>
                {activeSession.examName || 'ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026'}
              </h2>
              <h3 className={styles.printSeatingTitle}>Seating Arrangement</h3>
            </div>

            <div className={styles.printOfficialMetaBox}>
              <div className={styles.printCentreRow}>
                <strong>Centre code and name :</strong>
                <span>{activeSession.centreCode || '9460'} - {activeSession.centreName || 'Nagercoil Islam College of Engineering and Technology'}.</span>
              </div>
              <div className={styles.printMetaRow3}>
                <div className={styles.printMetaCol}>
                  <strong>Hall NO :</strong> <span>{activeHallData.hallNumber}.</span>
                </div>
                <div className={styles.printMetaCol}>
                  <strong>Date :</strong> <span>{activeSession.examDate ? new Date(activeSession.examDate).toLocaleDateString('en-GB') : 'N/A'}.</span>
                </div>
                <div className={styles.printMetaCol}>
                  <strong>Session :</strong> <span>{activeSession.session}.</span>
                </div>
              </div>
            </div>

            {/* Physical Seat Grid Box */}
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

            {/* Anna University Summary Table */}
            <div className={styles.printSummaryArea}>
              <table className={styles.printSummaryTable}>
                <thead>
                  <tr>
                    <th style={{ width: '12%', textAlign: 'center' }}>Hall No</th>
                    <th style={{ width: '25%' }}>Degree &amp; Branch</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Subject code</th>
                    <th style={{ width: '38%' }}>Register number of candidates</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>No of candidates</th>
                  </tr>
                </thead>
                <tbody>
                  {activeHallData.summaryList?.map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{activeHallData.hallNumber}</td>
                      <td style={{ fontWeight: 600 }}>{s.degreeBranch}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.subjectCode}</td>
                      <td style={{ fontSize: '9px', lineHeight: '1.4' }}>{s.registerNumbers}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.count}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td colSpan="4" style={{ textAlign: 'right', paddingRight: '12px' }}>TOTAL</td>
                    <td style={{ textAlign: 'center' }}>{activeHallData.occupiedCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Anna University Official Footer & Signatures */}
            <div className={styles.printFooterSignatures}>
              <div>
                Name &amp; Signature of Hall<br />superintendent
              </div>
              <div style={{ textAlign: 'right' }}>
                Signature of chief Superintendent
              </div>
            </div>

            <div className={styles.printPageNoContainer}>
              <span className={styles.printPageNoBox}>Page No: 1</span>
            </div>
          </div>
        )}

        {/* All Halls Container Sheet (for Multi-hall batch export) */}
        {seatingData?.halls?.length > 0 && activeSession && (
          <div ref={allHallsContainerRef}>
            {seatingData.halls.map((hData, hIndex) => (
              <div key={hData.hallId} className={styles.printSheet}>
                <div className={styles.printCollegeHeader}>
                  <h2 className={styles.printExamHeading}>
                    {activeSession.examName || 'ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026'}
                  </h2>
                  <h3 className={styles.printSeatingTitle}>Seating Arrangement</h3>
                </div>

                <div className={styles.printOfficialMetaBox}>
                  <div className={styles.printCentreRow}>
                    <strong>Centre code and name :</strong>
                    <span>{activeSession.centreCode || '9460'} - {activeSession.centreName || 'Nagercoil Islam College of Engineering and Technology'}.</span>
                  </div>
                  <div className={styles.printMetaRow3}>
                    <div className={styles.printMetaCol}>
                      <strong>Hall NO :</strong> <span>{hData.hallNumber}.</span>
                    </div>
                    <div className={styles.printMetaCol}>
                      <strong>Date :</strong> <span>{activeSession.examDate ? new Date(activeSession.examDate).toLocaleDateString('en-GB') : 'N/A'}.</span>
                    </div>
                    <div className={styles.printMetaCol}>
                      <strong>Session :</strong> <span>{activeSession.session}.</span>
                    </div>
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
                  <table className={styles.printSummaryTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '12%', textAlign: 'center' }}>Hall No</th>
                        <th style={{ width: '25%' }}>Degree &amp; Branch</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Subject code</th>
                        <th style={{ width: '38%' }}>Register number of candidates</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>No of candidates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hData.summaryList?.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{hData.hallNumber}</td>
                          <td style={{ fontWeight: 600 }}>{s.degreeBranch}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.subjectCode}</td>
                          <td style={{ fontSize: '9px', lineHeight: '1.4' }}>{s.registerNumbers}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.count}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                        <td colSpan="4" style={{ textAlign: 'right', paddingRight: '12px' }}>TOTAL</td>
                        <td style={{ textAlign: 'center' }}>{hData.occupiedCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={styles.printFooterSignatures}>
                  <div>
                    Name &amp; Signature of Hall<br />superintendent
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    Signature of chief Superintendent
                  </div>
                </div>

                <div className={styles.printPageNoContainer}>
                  <span className={styles.printPageNoBox}>Page No: {hIndex + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
