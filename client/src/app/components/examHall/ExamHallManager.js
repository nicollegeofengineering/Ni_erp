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
  ArrowRight,
  GraduationCap,
  FileText,
} from 'lucide-react';
import styles from './exam-hall.module.css';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

// Curated palette mapping for differentiating subject codes in seating grid
const SUBJECT_PALETTES = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badgeBg: '#dbeafe', badgeText: '#1e40af' }, // Blue
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badgeBg: '#dcfce7', badgeText: '#166534' }, // Green
  { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', badgeBg: '#f3e8ff', badgeText: '#6b21a8' }, // Purple
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', badgeBg: '#ffedd5', badgeText: '#9a3412' }, // Orange
  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', badgeBg: '#ccfbf1', badgeText: '#115e59' }, // Teal
  { bg: '#fefce8', border: '#fef08a', text: '#a16207', badgeBg: '#fef9c3', badgeText: '#854d0e' }, // Amber
  { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', badgeBg: '#ffe4e6', badgeText: '#9f1239' }, // Rose
  { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490', badgeBg: '#cffafe', badgeText: '#155e75' }, // Cyan
];

const getSubjectPalette = (subjectCode, allSubjects = []) => {
  if (!subjectCode) return null;
  let idx = allSubjects.indexOf(subjectCode);
  if (idx === -1) {
    let hash = 0;
    for (let i = 0; i < subjectCode.length; i++) {
      hash = subjectCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    idx = Math.abs(hash) % SUBJECT_PALETTES.length;
  } else {
    idx = idx % SUBJECT_PALETTES.length;
  }
  return SUBJECT_PALETTES[idx];
};

// Presets for Anna University Degrees & Branches
const ANNA_UNIV_DEGREES = [
  'B.E.',
  'B.Tech',
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
  'Computer Science and Engineering',
  'Artificial Intelligence and Data Science',
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

  // ---------- 1. EXAM TYPE SELECTION FLOW STATE ----------
  const [selectedExamType, setSelectedExamType] = useState('ANNA_UNIVERSITY'); // 'ANNA_UNIVERSITY' | 'INTERNAL'
  const [flowExamName, setFlowExamName] = useState(
    'ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026'
  );
  const [flowCentreCode, setFlowCentreCode] = useState('9640');
  const [flowCentreName, setFlowCentreName] = useState(
    'Noorul Islam College of Engineering and Technology'
  );
  const [flowExamDate, setFlowExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [flowSession, setFlowSession] = useState('FN'); // 'FN' | 'AN'
  const [flowLoading, setFlowLoading] = useState(false);

  // ---------- General State ----------
  const [masters, setMasters] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Candidates state
  const [candidateTab, setCandidateTab] = useState('range'); // 'range' | 'manual' | 'import' | 'list'
  const [candidates, setCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');

  // 1. Range form
  const [rangeForm, setRangeForm] = useState({
    year: '3',
    programme: 'B.E.',
    department: 'Computer Science and Engineering',
    departmentCode: 'CSE',
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
      programme: 'B.E.',
      department: 'Computer Science and Engineering',
      departmentCode: 'CSE',
      subjectCode: '',
      subjectName: '',
    },
  ]);

  // 3. Student DB lookup & import
  const [lookupFilter, setLookupFilter] = useState({
    departmentCode: '',
    year: '',
    semester: '',
    section: '',
    search: '',
  });
  const [lookupResult, setLookupResult] = useState({
    students: [],
    departments: [],
    subjects: [],
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [importSubjectCode, setImportSubjectCode] = useState('');
  const [importSubjectName, setImportSubjectName] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

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

  // Form Loading States for Animation
  const [addingRange, setAddingRange] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);
  const [hallSubmitting, setHallSubmitting] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);

  // Modals
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [editingMaster, setEditingMaster] = useState(null);
  const [masterForm, setMasterForm] = useState({
    examType: 'ANNA_UNIVERSITY',
    examCode: '',
    examName: '',
    centreCode: '9640',
    centreName: 'Noorul Islam College of Engineering and Technology',
  });

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
    () => sessions.find((s) => String(s._id) === String(selectedSessionId)) || null,
    [sessions, selectedSessionId]
  );

  // Active Hall Data for seating matrix / details
  const activeHallData = useMemo(() => {
    if (!seatingData?.halls || seatingData.halls.length === 0) return null;
    if (!activeHallViewId) return seatingData.halls[0];
    return seatingData.halls.find((h) => String(h.hallId) === String(activeHallViewId)) || seatingData.halls[0];
  }, [seatingData, activeHallViewId]);

  // Subject color palette mapping
  const subjectPaletteMap = useMemo(() => {
    const map = {};
    let colorIndex = 0;
    const allCodes = new Set();
    candidates.forEach((c) => {
      if (c.subjectCode?.trim()) allCodes.add(c.subjectCode.trim().toUpperCase());
    });
    if (seatingData?.halls) {
      seatingData.halls.forEach((h) => {
        if (h.seats) {
          Object.values(h.seats).forEach((st) => {
            if (st?.subjectCode?.trim()) allCodes.add(st.subjectCode.trim().toUpperCase());
          });
        }
      });
    }
    allCodes.forEach((code) => {
      map[code] = SUBJECT_PALETTES[colorIndex % SUBJECT_PALETTES.length];
      colorIndex++;
    });
    return map;
  }, [candidates, seatingData]);

  // Unique subjects present in current active hall
  const activeHallSubjects = useMemo(() => {
    if (!activeHallData?.seats) return [];
    const set = new Set();
    Object.values(activeHallData.seats).forEach((s) => {
      if (s?.subjectCode?.trim()) set.add(s.subjectCode.trim().toUpperCase());
    });
    return Array.from(set);
  }, [activeHallData]);

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
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }, [api]);

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
    if (!selectedSessionId) {
      setCandidates([]);
      setSeatingData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [candRes, seatRes] = await Promise.allSettled([
        api.get(`/candidates/${selectedSessionId}`),
        api.get(`/seating/${selectedSessionId}`),
      ]);

      if (candRes.status === 'fulfilled' && candRes.value.data?.success) {
        setCandidates(candRes.value.data.data || []);
      } else {
        setCandidates([]);
      }

      if (seatRes.status === 'fulfilled' && seatRes.value.data?.success) {
        setSeatingData(seatRes.value.data);
        if (seatRes.value.data.halls?.length > 0 && !activeHallViewId) {
          setActiveHallViewId(seatRes.value.data.halls[0].hallId);
        }
      } else {
        setSeatingData(null);
      }
    } catch (err) {
      console.error('Error loading session details:', err);
    } finally {
      setLoading(false);
    }
  }, [api, selectedSessionId, activeHallViewId]);

  useEffect(() => {
    fetchMasters();
    fetchSessions();
    fetchHalls();
  }, [fetchMasters, fetchSessions, fetchHalls]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  // Compute available master exam series strictly from saved masters
  const availableExamSeries = useMemo(() => {
    const list = masters
      .filter((m) => m.examType === selectedExamType)
      .map((m) => m.examName);

    if (list.length > 0) {
      return list;
    }

    // Fallback only if no masters exist in the database yet
    return selectedExamType === 'ANNA_UNIVERSITY'
      ? ['ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026']
      : ['Internal Examination 1', 'Internal Examination 2'];
  }, [masters, selectedExamType]);

  // Synchronize flow fields when masters or exam type change
  useEffect(() => {
    if (availableExamSeries.length > 0 && !availableExamSeries.includes(flowExamName)) {
      const nextName = availableExamSeries[0];
      setFlowExamName(nextName);
      const matched = masters.find(
        (m) => m.examType === selectedExamType && m.examName === nextName
      );
      if (matched) {
        if (matched.centreCode) setFlowCentreCode(matched.centreCode);
        if (matched.centreName) setFlowCentreName(matched.centreName);
      }
    }
  }, [availableExamSeries, flowExamName, masters, selectedExamType]);

  // Sync flow inputs when exam type changes
  const handleExamTypeChange = (type) => {
    setSelectedExamType(type);
    const typeMasters = masters.filter((m) => m.examType === type);
    const defaultName =
      typeMasters.length > 0
        ? typeMasters[0].examName
        : type === 'ANNA_UNIVERSITY'
        ? 'ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026'
        : 'Internal Examination 1';

    setFlowExamName(defaultName);
    const matched = typeMasters.find((m) => m.examName === defaultName);
    if (matched) {
      if (matched.centreCode) setFlowCentreCode(matched.centreCode);
      if (matched.centreName) setFlowCentreName(matched.centreName);
    }
  };

  // ---------- FLOW: GET DETAILS / CONTINUE ACTION ----------
  const handleFlowGetDetails = async (e) => {
    if (e) e.preventDefault();
    if (!flowExamName?.trim() || !flowExamDate || !flowSession) {
      showAlert('error', 'Please fill all examination series fields.');
      return;
    }

    setFlowLoading(true);
    try {
      const res = await api.post('/flow/session', {
        examType: selectedExamType,
        examName: flowExamName.trim(),
        centreCode: flowCentreCode.trim(),
        centreName: flowCentreName.trim(),
        examDate: flowExamDate,
        session: flowSession,
      });

      if (res.data?.success && res.data.data?._id) {
        const sessionObj = res.data.data;
        await fetchSessions();
        setSelectedSessionId(sessionObj._id);
        showAlert(
          'success',
          res.data.isNew
            ? `New ${selectedExamType === 'INTERNAL' ? 'Internal' : 'Anna University'} examination schedule created.`
            : `Loaded active ${selectedExamType === 'INTERNAL' ? 'Internal' : 'Anna University'} examination schedule.`
        );
      }
    } catch (err) {
      console.error('Error resolving session:', err);
      showAlert('error', err.response?.data?.message || 'Failed to resolve exam session.');
    } finally {
      setFlowLoading(false);
    }
  };

  // ---------- DELETE EXAM SCHEDULE (DATE & SESSION) WITH FULL CASCADE ----------
  const handleDeleteSession = async (sessionId) => {
    const sessionToDelete = sessions.find((s) => s._id === sessionId) || activeSession;
    const sName = sessionToDelete
      ? `[${sessionToDelete.examType === 'INTERNAL' ? 'INTERNAL' : 'ANNA UNIV'}] ${sessionToDelete.examName} (${new Date(sessionToDelete.examDate).toLocaleDateString('en-GB')} - ${sessionToDelete.session})`
      : 'this schedule';

    if (
      !window.confirm(
        `Are you sure you want to delete ${sName}?\n\nWARNING: All registered candidates and seating allocations for this date & session will also be permanently deleted.`
      )
    ) {
      return;
    }

    try {
      const res = await api.delete(`/sessions/${sessionId}`);
      if (res.data?.success) {
        showAlert('success', 'Exam schedule and all associated candidate/seating data deleted successfully.');
        if (selectedSessionId === sessionId) {
          setSelectedSessionId('');
          setCandidates([]);
          setSeatingData(null);
        }
        await fetchSessions();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete exam schedule.');
    }
  };

  // ---------- Student DB Lookup ----------
  const handleLookupStudents = async () => {
    setLookupLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (lookupFilter.departmentCode) queryParams.append('departmentCode', lookupFilter.departmentCode);
      if (lookupFilter.year) queryParams.append('year', lookupFilter.year);
      if (lookupFilter.semester) queryParams.append('semester', lookupFilter.semester);
      if (lookupFilter.section) queryParams.append('section', lookupFilter.section);
      if (lookupFilter.search) queryParams.append('search', lookupFilter.search);

      const res = await api.get(`/students/lookup?${queryParams.toString()}`);
      if (res.data?.success) {
        setLookupResult({
          students: res.data.students || [],
          departments: res.data.departments || [],
          subjects: res.data.subjects || [],
        });
        setSelectedStudentIds(res.data.students.map((s) => s._id));
      }
    } catch (err) {
      showAlert('error', 'Failed to lookup students from database.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleImportStudents = async () => {
    if (!selectedSessionId) {
      showAlert('error', 'Please select or continue an exam session first.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      showAlert('error', 'Please select at least one student to import.');
      return;
    }
    if (!importSubjectCode?.trim()) {
      showAlert('error', 'Subject Code is required for candidate import.');
      return;
    }

    setImportingStudents(true);
    try {
      const res = await api.post('/candidates/import-students', {
        sessionId: selectedSessionId,
        studentIds: selectedStudentIds,
        subjectCode: importSubjectCode.trim().toUpperCase(),
        subjectName: importSubjectName.trim(),
      });
      if (res.data?.success) {
        showAlert('success', res.data.message);
        setSelectedStudentIds([]);
        setImportSubjectCode('');
        setImportSubjectName('');
        await fetchSessionDetails();
        setCandidateTab('list');
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to import students.');
    } finally {
      setImportingStudents(false);
    }
  };

  // ---------- Range Entry Submission ----------
  const handleAddRangeCandidates = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) {
      showAlert('error', 'Please select or continue an exam session first.');
      return;
    }

    setAddingRange(true);
    try {
      const isInternal = (activeSession?.examType || selectedExamType) === 'INTERNAL';
      const yearNum = isInternal && rangeForm.year ? Number(rangeForm.year) : null;
      const yearLabel = isInternal && rangeForm.year
        ? rangeForm.year === '1'
          ? 'I Year'
          : rangeForm.year === '2'
            ? 'II Year'
            : rangeForm.year === '3'
              ? 'III Year'
              : rangeForm.year === '4'
                ? 'IV Year'
                : `${rangeForm.year} Year`
        : '';

      const res = await api.post('/candidates/range', {
        sessionId: selectedSessionId,
        programme: rangeForm.programme,
        department: rangeForm.department,
        departmentCode: rangeForm.departmentCode,
        year: yearNum,
        yearString: yearLabel,
        subjectCode: rangeForm.subjectCode.trim().toUpperCase(),
        subjectName: rangeForm.subjectName.trim(),
        registerNoFrom: rangeForm.registerNoFrom.trim(),
        registerNoTo: rangeForm.registerNoTo.trim(),
        defaultNamePrefix: rangeForm.defaultNamePrefix.trim(),
      });

      if (res.data?.success) {
        showAlert('success', res.data.message);
        // Clear all range input fields after successful addition
        setRangeForm({
          year: '1',
          programme: 'B.E.',
          department: '',
          departmentCode: '',
          subjectCode: '',
          subjectName: '',
          registerNoFrom: '',
          registerNoTo: '',
          defaultNamePrefix: '',
        });
        await fetchSessionDetails();
        setCandidateTab('list');
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to add range candidates.');
    } finally {
      setAddingRange(false);
    }
  };

  // ---------- Manual Entry Submission ----------
  const handleAddManualCandidates = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) {
      showAlert('error', 'Please select or continue an exam session first.');
      return;
    }

    const validRows = manualRows.filter((r) => r.registerNo?.trim() && r.subjectCode?.trim());
    if (validRows.length === 0) {
      showAlert('error', 'Please provide at least one valid row with Register No and Subject Code.');
      return;
    }

    setAddingManual(true);
    try {
      const res = await api.post('/candidates/manual', {
        sessionId: selectedSessionId,
        candidates: validRows,
      });

      if (res.data?.success) {
        showAlert('success', res.data.message);
        // Clear all manual rows after successful addition
        setManualRows([
          {
            registerNo: '',
            name: '',
            programme: 'B.E.',
            department: '',
            departmentCode: '',
            subjectCode: '',
            subjectName: '',
          },
        ]);
        await fetchSessionDetails();
        setCandidateTab('list');
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to add manual candidates.');
    } finally {
      setAddingManual(false);
    }
  };

  const handleUpdateCandidate = async (e) => {
    e.preventDefault();
    if (!editingCandidate) return;

    try {
      const res = await api.put(`/candidates/${editingCandidate._id}`, editingCandidate);
      if (res.data?.success) {
        showAlert('success', 'Candidate updated successfully.');
        setEditingCandidate(null);
        fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to update candidate.');
    }
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) return;
    try {
      const res = await api.delete(`/candidates/${id}`);
      if (res.data?.success) {
        showAlert('success', 'Candidate deleted successfully.');
        fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete candidate.');
    }
  };

  // ---------- Hall Management ----------
  const handleCreateHall = async (e) => {
    e.preventDefault();
    if (!hallForm.hallNumber?.trim()) {
      showAlert('error', 'Hall Number is required.');
      return;
    }

    setHallSubmitting(true);
    try {
      const res = await api.post('/halls', hallForm);
      if (res.data?.success) {
        showAlert('success', `Hall '${res.data.data.hallNumber}' created successfully.`);
        setHallForm({ hallNumber: '', layoutType: 'FIVE_BY_FIVE' });
        fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to create hall.');
    } finally {
      setHallSubmitting(false);
    }
  };

  const handleUpdateHall = async (e) => {
    e.preventDefault();
    if (!editingHall) return;

    setHallSubmitting(true);
    try {
      const res = await api.put(`/halls/${editingHall._id}`, editingHall);
      if (res.data?.success) {
        showAlert('success', 'Hall updated successfully.');
        setEditingHall(null);
        fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to update hall.');
    } finally {
      setHallSubmitting(false);
    }
  };

  const handleDeleteHall = async (id) => {
    if (!window.confirm('Are you sure you want to delete this hall?')) return;
    try {
      const res = await api.delete(`/halls/${id}`);
      if (res.data?.success) {
        showAlert('success', 'Hall deleted successfully.');
        fetchHalls();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete hall.');
    }
  };

  // ---------- Smart Select Halls according to available candidates ----------
  const handleSmartSelectHalls = () => {
    if (candidates.length === 0) {
      showAlert(
        'error',
        'No candidates registered in this exam schedule yet. Please register candidates first to smart select halls.'
      );
      return;
    }
    if (halls.length === 0) {
      showAlert('error', 'No exam halls found. Please add halls first.');
      return;
    }

    const neededCandidates = candidates.length;
    let accumulatedCapacity = 0;
    const selected = [];

    // Sort active halls in natural order (e.g. D401, D402)
    const sortedHalls = [...halls].sort((a, b) =>
      a.hallNumber.localeCompare(b.hallNumber, undefined, { numeric: true })
    );

    for (const hall of sortedHalls) {
      selected.push(hall._id);
      accumulatedCapacity += hall.capacity || 25;
      if (accumulatedCapacity >= neededCandidates) {
        break;
      }
    }

    setSelectedHallIds(selected);
    showAlert(
      'success',
      `Smart Select: Selected ${selected.length} hall(s) for ${neededCandidates} candidate(s) (${accumulatedCapacity} total seats capacity).`
    );
  };

  // ---------- Allocation Engine Actions ----------
  const handleGenerateAllocation = async () => {
    if (!selectedSessionId) {
      showAlert('error', 'Please select or create an exam schedule first.');
      return;
    }
    if (selectedHallIds.length === 0) {
      showAlert('error', 'Please select at least one hall for allocation.');
      return;
    }
    if (candidates.length === 0) {
      showAlert('error', 'No candidates registered in this schedule. Please add candidates first.');
      return;
    }

    setAllocating(true);
    try {
      const res = await api.post('/allocation/generate', {
        sessionId: selectedSessionId,
        hallIds: selectedHallIds,
      });

      if (res.data?.success) {
        showAlert('success', res.data.message);
        await fetchSessions();
        await fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Allocation failed. Please check capacity.');
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
      if (res.data?.success) {
        showAlert('success', 'Seating arrangement deleted successfully.');
        fetchSessions();
        fetchSessionDetails();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete allocation.');
    }
  };

  // ---------- PDF Export Handlers (Official Vector Backend PDF) ----------
  const handleDownloadSinglePdf = async () => {
    if (!activeSession || !activeHallData) {
      showAlert('error', 'No seating data available for PDF export.');
      return;
    }

    setPdfGenerating(true);
    try {
      const res = await api.get(`/pdf/${activeSession._id}?hallId=${activeHallData.hallId}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const typePrefix = (activeSession.examType || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `${typePrefix}_Seating_${activeHallData.hallNumber || 'Hall'}_${activeSession.session || 'FN'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showAlert('success', 'Official Seating PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF error:', err);
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

    setPdfGenerating(true);
    try {
      const res = await api.get(`/pdf/${activeSession._id}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const typePrefix = (activeSession.examType || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `${typePrefix}_Seating_ALL_HALLS_${activeSession.session || 'FN'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showAlert('success', 'All Halls Seating PDF downloaded successfully.');
    } catch (err) {
      console.error('All Halls PDF error:', err);
      showAlert('error', 'Failed to generate All Halls PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  // Candidate Search
  const handleSearchCandidate = async (e) => {
    e.preventDefault();
    if (!selectedSessionId || !searchRegNo.trim()) return;

    setSearchLoading(true);
    try {
      const res = await api.get(
        `/search?sessionId=${selectedSessionId}&registerNo=${encodeURIComponent(searchRegNo.trim())}`
      );
      if (res.data?.success) {
        setSearchResult(res.data.data);
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Candidate seating not found.');
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
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
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Exam Hall Allocation</h1>
          <p>College ERP Seating Arrangement Engine (Anna University &amp; Internal Examinations)</p>
        </div>

        <div className={styles.sessionSelectorArea}>
          <div className={styles.sessionSelectRow}>
            <select
              className={styles.sessionSelect}
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              {sessions.length === 0 ? (
                <option value="">No Active Exam Schedules Found</option>
              ) : (
                sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    [{s.examType === 'INTERNAL' ? 'INTERNAL' : 'ANNA UNIV'}] {s.examName} (
                    {new Date(s.examDate).toLocaleDateString('en-GB')} - {s.session}) [{s.status}]
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={styles.sessionButtonsRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => setShowMasterModal(true)}
              title="Configure Exam Masters"
            >
              <Settings size={14} /> Exam Series / Masters
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => setShowAllExamsModal(true)}
              title="View All Exam Schedules"
            >
              <Calendar size={14} /> All Schedules ({sessions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner - Fixed Floating Toast Notification */}
      {alert.message && (
        <div
          className={`${styles.alert} ${alert.type === 'success' ? styles.alertSuccess : styles.alertError}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {alert.type === 'success' ? (
              <CheckCircle size={18} color="#16a34a" />
            ) : (
              <AlertCircle size={18} color="#dc2626" />
            )}
            <span>{alert.message}</span>
          </div>
          <button
            type="button"
            className={styles.alertCloseBtn}
            onClick={() => setAlert({ type: '', message: '' })}
            title="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* ==================== MAIN REQUIREMENT: EXAM TYPE & SERIES SELECTION FLOW ==================== */}
      <section className={styles.flowCard}>
        <div className={styles.flowHeader}>
          <h2>
            <GraduationCap size={22} color="#2563eb" /> Examination Configuration Flow
          </h2>
          {activeSession && (
            <span
              className={`${styles.badge} ${activeSession.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft}`}
            >
              Current Active: {activeSession.examType} [{activeSession.status}]
            </span>
          )}
        </div>

        {/* Step 1: Exam Type Selection */}
        <div className={styles.examTypeGrid}>
          <div
            className={`${styles.examTypeOption} ${selectedExamType === 'ANNA_UNIVERSITY' ? styles.examTypeOptionActive : ''}`}
            onClick={() => handleExamTypeChange('ANNA_UNIVERSITY')}
          >
            <div className={styles.examTypeIcon}>
              <GraduationCap size={24} />
            </div>
            <div>
              <div className={styles.examTypeTitle}>Anna University Examination</div>
              <div className={styles.examTypeDesc}>
                Official University format with Degree &amp; Branch summary &amp; Anna Univ logo
              </div>
            </div>
          </div>

          <div
            className={`${styles.examTypeOption} ${selectedExamType === 'INTERNAL' ? styles.examTypeOptionActive : ''}`}
            onClick={() => handleExamTypeChange('INTERNAL')}
          >
            <div className={styles.examTypeIcon}>
              <FileText size={24} />
            </div>
            <div>
              <div className={styles.examTypeTitle}>Internal Examination</div>
              <div className={styles.examTypeDesc}>
                Internal Test format with Year &amp; Branch summary &amp; College logo
              </div>
            </div>
          </div>
        </div>

        {/* Step 2, 3, 4: Exam Series Name, College Details, Date, Session, and Continue Action */}
        <form onSubmit={handleFlowGetDetails} className={styles.flowFieldsGrid}>
          <div className={`${styles.formGroup} ${styles.flowExamNameGroup}`}>
            <label>
              <strong>Exam Name / Master Series *</strong>
            </label>
            <select
              className={styles.select}
              value={flowExamName}
              onChange={(e) => {
                const name = e.target.value;
                setFlowExamName(name);
                const matched = masters.find(
                  (m) => m.examType === selectedExamType && m.examName === name
                );
                if (matched) {
                  if (matched.centreCode) setFlowCentreCode(matched.centreCode);
                  if (matched.centreName) setFlowCentreName(matched.centreName);
                }
              }}
              required
            >
              {availableExamSeries.map((sName) => (
                <option key={sName} value={sName}>
                  {sName}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles.formGroup} ${styles.flowCollegeCodeGroup}`}>
            <label>
              <strong>College Code</strong>
            </label>
            <input
              className={styles.input}
              placeholder="e.g. 9640"
              value={flowCentreCode}
              onChange={(e) => setFlowCentreCode(e.target.value)}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.flowCollegeNameGroup}`}>
            <label>
              <strong>College Name</strong>
            </label>
            <input
              className={styles.input}
              placeholder="e.g. Noorul Islam College of Engineering and Technology"
              value={flowCentreName}
              onChange={(e) => setFlowCentreName(e.target.value)}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.flowDateGroup}`}>
            <label>
              <strong>Exam Date *</strong>
            </label>
            <input
              type="date"
              className={styles.input}
              value={flowExamDate}
              onChange={(e) => setFlowExamDate(e.target.value)}
              required
            />
          </div>

          <div className={`${styles.formGroup} ${styles.flowSessionGroup}`}>
            <label>
              <strong>Session *</strong>
            </label>
            <div className={styles.sessionToggleGroup}>
              <button
                type="button"
                className={`${styles.sessionToggleBtn} ${flowSession === 'FN' ? styles.sessionToggleBtnActive : ''}`}
                onClick={() => setFlowSession('FN')}
              >
                FN
              </button>
              <button
                type="button"
                className={`${styles.sessionToggleBtn} ${flowSession === 'AN' ? styles.sessionToggleBtnActive : ''}`}
                onClick={() => setFlowSession('AN')}
              >
                AN
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.flowSubmitBtn}`}
            disabled={flowLoading}
          >
            {flowLoading ? <RefreshCw size={15} className="spin" /> : <ArrowRight size={16} />}
            Get Details / Continue
          </button>
        </form>
      </section>

      {/* ==================== 1. CANDIDATE ENTRY ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Users size={20} /> 1. Candidate Entry (Students Registration)
          </h2>
          <span className={`${styles.badge} ${styles.badgeDraft}`}>
            Registered Candidates: {candidates.length}
          </span>
        </div>

        {/* Active Schedule Banner */}
        {activeSession ? (
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
              <span
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Active Examination Schedule:{' '}
              </span>
              <strong style={{ fontSize: '15px', color: '#0f172a', marginRight: '8px' }}>
                {activeSession.examName}
              </strong>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                ({new Date(activeSession.examDate).toLocaleDateString('en-GB')} -{' '}
                <strong>{activeSession.session}</strong>)
              </span>
              {activeSession.centreCode && (
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                  [{activeSession.centreCode} – {activeSession.centreName}]
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className={`${styles.badge} ${activeSession.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft}`}
              >
                Status: {activeSession.status}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                onClick={() => handleDeleteSession(activeSession._id)}
                title="Delete this exam schedule, candidates, and seatings"
              >
                <Trash2 size={13} /> Delete Schedule
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '8px',
              marginBottom: '18px',
              color: '#92400e',
              fontSize: '14px',
            }}
          >
            Please click <strong>Get Details / Continue</strong> in the configuration box above to
            activate an examination schedule.
          </div>
        )}

        {/* Tab Navigation */}
        <div className={styles.tabsNav}>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'range' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('range')}
          >
            <Layers size={14} /> Register Number Range
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'manual' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('manual')}
          >
            <Plus size={14} /> Manual Candidate Entry
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'import' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('import')}
          >
            <BookOpen size={14} /> Import from Student Database
          </button>
          <button
            className={`${styles.tabBtn} ${candidateTab === 'list' ? styles.tabBtnActive : ''}`}
            onClick={() => setCandidateTab('list')}
          >
            <Users size={14} /> Candidate List ({candidates.length})
          </button>
        </div>

        {/* Tab 1: Range Entry */}
        {candidateTab === 'range' && (
          <form onSubmit={handleAddRangeCandidates}>
            <div className={styles.formGrid}>
              {(activeSession?.examType || selectedExamType) === 'INTERNAL' && (
                <div className={styles.formGroup}>
                  <label>Academic Year *</label>
                  <select
                    className={styles.select}
                    value={rangeForm.year || '3'}
                    onChange={(e) => setRangeForm({ ...rangeForm, year: e.target.value })}
                  >
                    <option value="1">1st Year (I Year)</option>
                    <option value="2">2nd Year (II Year)</option>
                    <option value="3">3rd Year (III Year)</option>
                    <option value="4">4th Year (IV Year)</option>
                  </select>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Degree Programme *</label>
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
                  placeholder="e.g. Computer Science and Engineering"
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
                  placeholder="e.g. CS3451"
                  value={rangeForm.subjectCode}
                  onChange={(e) => setRangeForm({ ...rangeForm, subjectCode: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Subject Name</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Operating Systems"
                  value={rangeForm.subjectName}
                  onChange={(e) => setRangeForm({ ...rangeForm, subjectName: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Register No From *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 23CSE001"
                  value={rangeForm.registerNoFrom}
                  onChange={(e) => setRangeForm({ ...rangeForm, registerNoFrom: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Register No To *</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 23CSE025"
                  value={rangeForm.registerNoTo}
                  onChange={(e) => setRangeForm({ ...rangeForm, registerNoTo: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Default Name Prefix (Optional)</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Student"
                  value={rangeForm.defaultNamePrefix}
                  onChange={(e) => setRangeForm({ ...rangeForm, defaultNamePrefix: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={addingRange}>
              {addingRange ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
              {addingRange ? 'Adding Candidates...' : 'Add Range Batch'}
            </button>
          </form>
        )}

        {/* Tab 2: Manual Rows Entry */}
        {candidateTab === 'manual' && (
          <form onSubmit={handleAddManualCandidates}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Register No *</th>
                    <th style={{ width: '22%' }}>Candidate Name</th>
                    <th style={{ width: '15%' }}>Degree</th>
                    <th style={{ width: '25%' }}>Branch / Department</th>
                    <th style={{ width: '15%' }}>Subject Code *</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {manualRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="23CSE001"
                          value={row.registerNo}
                          onChange={(e) => {
                            const updated = [...manualRows];
                            updated[idx].registerNo = e.target.value;
                            setManualRows(updated);
                          }}
                          required
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="Student Name"
                          value={row.name}
                          onChange={(e) => {
                            const updated = [...manualRows];
                            updated[idx].name = e.target.value;
                            setManualRows(updated);
                          }}
                        />
                      </td>
                      <td>
                        <select
                          className={styles.select}
                          value={row.programme || 'B.E.'}
                          onChange={(e) => {
                            const updated = [...manualRows];
                            updated[idx].programme = e.target.value;
                            setManualRows(updated);
                          }}
                        >
                          {ANNA_UNIV_DEGREES.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          value={row.department || ''}
                          onChange={(e) => {
                            const updated = [...manualRows];
                            updated[idx].department = e.target.value;
                            setManualRows(updated);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          placeholder="CS3451"
                          value={row.subjectCode}
                          onChange={(e) => {
                            const updated = [...manualRows];
                            updated[idx].subjectCode = e.target.value;
                            setManualRows(updated);
                          }}
                          required
                        />
                      </td>
                      <td>
                        {manualRows.length > 1 && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            onClick={() => setManualRows(manualRows.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() =>
                  setManualRows([
                    ...manualRows,
                    {
                      registerNo: '',
                      name: '',
                      programme: 'B.E.',
                      department: 'Computer Science and Engineering',
                      departmentCode: 'CSE',
                      subjectCode: manualRows[0]?.subjectCode || '',
                      subjectName: manualRows[0]?.subjectName || '',
                    },
                  ])
                }
              >
                <Plus size={14} /> Add Row
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={addingManual}>
                {addingManual ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
                {addingManual ? 'Saving Candidates...' : 'Save Candidates'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Import from Student Database */}
        {candidateTab === 'import' && (
          <div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Department Code</label>
                <input
                  className={styles.input}
                  placeholder="e.g. CSE"
                  value={lookupFilter.departmentCode}
                  onChange={(e) =>
                    setLookupFilter({ ...lookupFilter, departmentCode: e.target.value })
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label>Year</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="e.g. 3"
                  value={lookupFilter.year}
                  onChange={(e) => setLookupFilter({ ...lookupFilter, year: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Section</label>
                <input
                  className={styles.input}
                  placeholder="e.g. A"
                  value={lookupFilter.section}
                  onChange={(e) => setLookupFilter({ ...lookupFilter, section: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Search Query</label>
                <input
                  className={styles.input}
                  placeholder="Name or Register No"
                  value={lookupFilter.search}
                  onChange={(e) => setLookupFilter({ ...lookupFilter, search: e.target.value })}
                />
              </div>
            </div>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={handleLookupStudents}
              disabled={lookupLoading}
              style={{ marginBottom: '16px' }}
            >
              {lookupLoading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />} Fetch
              Active Students
            </button>

            {lookupResult.students.length > 0 && (
              <div>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '14px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>
                        <strong>Assign Subject Code *</strong>
                      </label>
                      <input
                        className={styles.input}
                        placeholder="e.g. CS3451"
                        value={importSubjectCode}
                        onChange={(e) => setImportSubjectCode(e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Subject Name</label>
                      <input
                        className={styles.input}
                        placeholder="e.g. Operating Systems"
                        value={importSubjectName}
                        onChange={(e) => setImportSubjectName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.tableWrapper} style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '5%' }}>
                          <input
                            type="checkbox"
                            checked={
                              selectedStudentIds.length === lookupResult.students.length &&
                              lookupResult.students.length > 0
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds(lookupResult.students.map((s) => s._id));
                              } else {
                                setSelectedStudentIds([]);
                              }
                            }}
                          />
                        </th>
                        <th>Register No</th>
                        <th>Student Name</th>
                        <th>Year</th>
                        <th>Degree &amp; Branch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lookupResult.students.map((st) => (
                        <tr key={st._id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(st._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds([...selectedStudentIds, st._id]);
                                } else {
                                  setSelectedStudentIds(
                                    selectedStudentIds.filter((id) => id !== st._id)
                                  );
                                }
                              }}
                            />
                          </td>
                          <td>
                            <strong>{st.register_no}</strong>
                          </td>
                          <td>{st.name}</td>
                          <td>{st.yearString || `${st.year} Year`}</td>
                          <td>
                            {st.programme} {st.department_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleImportStudents}
                  disabled={importingStudents || selectedStudentIds.length === 0}
                >
                  {importingStudents ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                  {importingStudents ? 'Importing Selected Students...' : `Import Selected (${selectedStudentIds.length}) Students`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Candidate List */}
        {candidateTab === 'list' && (
          <div>
            <div style={{ marginBottom: '14px', maxWidth: '350px' }}>
              <input
                className={styles.input}
                placeholder="Search candidates..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
              />
            </div>

            <div className={styles.tableWrapper} style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Register No</th>
                    <th>Name</th>
                    <th>Degree &amp; Branch</th>
                    <th>Subject</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No candidates found in this exam schedule.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((c, i) => (
                      <tr key={c._id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{c.registerNo}</strong>
                        </td>
                        <td>{c.name}</td>
                        <td>
                          {c.programme} {c.department || c.departmentCode}
                        </td>
                        <td>
                          <span
                            className={styles.badge}
                            style={{
                              background: '#eff6ff',
                              color: '#1e40af',
                              fontWeight: 700,
                            }}
                          >
                            {c.subjectCode}
                          </span>{' '}
                          {c.subjectName}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                              onClick={() => setEditingCandidate(c)}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                              onClick={() => handleDeleteCandidate(c._id)}
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

      {/* ==================== 2. HALL MANAGEMENT ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Building2 size={20} /> 2. Exam Hall Management (25-Seat Capacity)
          </h2>
          <span className={`${styles.badge} ${styles.badgeDraft}`}>
            Selected Halls: {selectedHallIds.length} ({selectedHallIds.length * 25} Total Seats)
          </span>
        </div>

        {/* Add New Hall Form */}
        <form
          onSubmit={handleCreateHall}
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '18px',
          }}
        >
          <div className={styles.formGrid} style={{ alignItems: 'flex-end', marginBottom: 0 }}>
            <div className={styles.formGroup}>
              <label>Hall Number *</label>
              <input
                className={styles.input}
                placeholder="e.g. D401"
                value={hallForm.hallNumber}
                onChange={(e) => setHallForm({ ...hallForm, hallNumber: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Layout Geometry *</label>
              <select
                className={styles.select}
                value={hallForm.layoutType}
                onChange={(e) => setHallForm({ ...hallForm, layoutType: e.target.value })}
              >
                <option value="FIVE_BY_FIVE">5 × 5 Grid (25 Seats)</option>
                <option value="FOUR_BY_SIX_PLUS_ONE">4 × 6 + 1 Grid (25 Seats)</option>
              </select>
            </div>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={hallSubmitting}>
              {hallSubmitting ? (
                <RefreshCw size={15} className="spin" />
              ) : editingHall ? (
                <CheckCircle size={15} />
              ) : (
                <Plus size={15} />
              )}
              {hallSubmitting ? 'Saving Hall...' : editingHall ? 'Update Hall' : 'Add Hall'}
            </button>
          </div>
        </form>

        {/* Hall Selection Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
              onClick={handleSmartSelectHalls}
              title="Automatically select the required halls based on currently registered candidates"
            >
              <Sparkles size={13} /> Smart Select ({Math.ceil((candidates.length || 0) / 25)} Hall{Math.ceil((candidates.length || 0) / 25) !== 1 ? 's' : ''} for {candidates.length} Candidate{candidates.length !== 1 ? 's' : ''})
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
              onClick={() => setSelectedHallIds(halls.map((h) => h._id))}
            >
              <CheckCircle size={13} /> Select All ({halls.length})
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
              onClick={() => setSelectedHallIds([])}
            >
              Deselect All
            </button>
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Selected: <strong>{selectedHallIds.length} Hall{selectedHallIds.length !== 1 ? 's' : ''}</strong> ({selectedHallIds.length * 25} Seats) | Needed: <strong>{candidates.length} Candidate{candidates.length !== 1 ? 's' : ''}</strong>
          </span>
        </div>

        {/* Halls Grid Selection */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {halls.map((h) => {
            const isSelected = selectedHallIds.includes(h._id);
            return (
              <div
                key={h._id}
                style={{
                  border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: isSelected ? '#eff6ff' : '#ffffff',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => {
                  if (isSelected) {
                    setSelectedHallIds(selectedHallIds.filter((id) => id !== h._id));
                  } else {
                    setSelectedHallIds([...selectedHallIds, h._id]);
                  }
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                    Hall {h.hallNumber}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {h.layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? '4 × 6 + 1' : '5 × 5'} (25 Seats)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => { }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== 3. ALLOCATION & SEATING ARRANGEMENT ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Grid size={20} /> 3. Seating Allocation &amp; Arrangement
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeSession?.status === 'ALLOCATED' ? (
              <>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnWarning}`}
                  onClick={() => setShowRegenerateModal(true)}
                  disabled={allocating}
                >
                  {allocating ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
                  {allocating ? 'Regenerating...' : 'Regenerate Allocation'}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => setShowDeleteAllocationModal(true)}
                  disabled={allocating}
                >
                  <Trash2 size={14} /> Delete Allocation
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleGenerateAllocation}
                disabled={allocating || candidates.length === 0 || selectedHallIds.length === 0}
              >
                {allocating ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />}
                {allocating ? 'Allocating & Arranging Seats...' : 'Generate Seating Allocation'}
              </button>
            )}
          </div>
        </div>

        {seatingData?.halls?.length > 0 ? (
          <div>
            {/* Allocation Metrics Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL CANDIDATES</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{candidates.length}</div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>ALLOCATED SEATS</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{seatingData.totalAllocated}</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>ASSIGNED HALLS</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>{seatingData.halls.length}</div>
              </div>
            </div>

            {/* Hall Selector Tabs */}
            <div className={styles.hallTabs}>
              {seatingData.halls.map((h) => {
                const isActive = activeHallData?.hallId === h.hallId;
                return (
                  <button
                    key={h.hallId}
                    className={`${styles.hallTab} ${isActive ? styles.hallTabActive : ''}`}
                    onClick={() => setActiveHallViewId(h.hallId)}
                  >
                    Hall {h.hallNumber} ({h.occupiedCount} Seats)
                  </button>
                );
              })}
            </div>

            {/* 4-BLOCK VERTICAL SEATING TABLE (Exact Match to Reference Layout) */}
            {activeHallData && (
              <div style={{ background: '#ffffff', border: '1.5px solid #0f172a', borderRadius: '10px', padding: '18px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
                    Hall {activeHallData.hallNumber} Seating Grid ({activeHallData.layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? '4 Vertical Blocks' : '5 Columns'})
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Layout: <strong>{activeHallData.layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? '4 × 6 + 1' : '5 × 5'}</strong> | Occupied: <strong>{activeHallData.occupiedCount} / 25</strong>
                  </div>
                </div>

                {/* Subject Color Differentiation Legend */}
                {activeHallSubjects.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                      marginBottom: '16px',
                      alignItems: 'center',
                      background: '#f8fafc',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                      Subjects in Hall {activeHallData.hallNumber}:
                    </span>
                    {activeHallSubjects.map((subCode) => {
                      const pal = subjectPaletteMap[subCode] || SUBJECT_PALETTES[0];
                      return (
                        <span
                          key={subCode}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: pal.badgeBg,
                            color: pal.badgeText,
                            fontSize: '12px',
                            fontWeight: 700,
                            border: `1.5px solid ${pal.border}`,
                          }}
                        >
                          <span
                            style={{
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              background: pal.text,
                            }}
                          />
                          {subCode}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Dynamic Columns / Blocks across page based on Hall Layout */}
                <div className={styles.blocksPreviewArea}>
                  {(activeHallData.layoutType === 'FOUR_BY_SIX_PLUS_ONE'
                    ? [
                      [1, 5, 9, 13, 17, 21, 25],
                      [2, 6, 10, 14, 18, 22],
                      [3, 7, 11, 15, 19, 23],
                      [4, 8, 12, 16, 20, 24],
                    ]
                    : [
                      [1, 6, 11, 16, 21],
                      [2, 7, 12, 17, 22],
                      [3, 8, 13, 18, 23],
                      [4, 9, 14, 19, 24],
                      [5, 10, 15, 20, 25],
                    ]
                  ).map((seatNums, bIdx) => (
                    <table key={bIdx} className={styles.blockTable}>
                      <thead>
                        <tr>
                          <th className={styles.blockSeatNo}>Seat No</th>
                          <th className={styles.blockRegNo}>Register No</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seatNums.map((sNum) => {
                          const seat = activeHallData.seats ? activeHallData.seats[sNum] : null;
                          const subCode = seat?.subjectCode?.trim()?.toUpperCase();
                          const pal = subCode ? (subjectPaletteMap[subCode] || SUBJECT_PALETTES[0]) : null;
                          return (
                            <tr
                              key={sNum}
                              style={{
                                background: pal ? pal.bg : '#ffffff',
                              }}
                            >
                              <td
                                className={styles.blockSeatNo}
                                style={{
                                  fontWeight: 700,
                                  borderLeft: pal ? `3.5px solid ${pal.text}` : 'none',
                                  color: pal ? pal.text : '#64748b',
                                }}
                              >
                                {sNum}
                              </td>
                              <td className={styles.blockRegNo}>
                                {seat ? (
                                  <div>
                                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                                      {seat.registerNo}
                                    </span>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        marginLeft: '6px',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        background: pal.badgeBg,
                                        color: pal.badgeText,
                                        border: `1px solid ${pal.border}`,
                                      }}
                                    >
                                      {seat.subjectCode}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ))}
                </div>

                {/* Hall Summary Table (No Common Sub, Merged Hall No) */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: '#0f172a' }}>
                    {activeSession?.examType === 'INTERNAL'
                      ? 'Internal Examination Summary (Year & Branch)'
                      : 'Anna University Degree & Branch Summary'}
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: '12%', textAlign: 'center' }}>Hall No</th>
                          {activeSession?.examType === 'INTERNAL' ? (
                            <>
                              <th style={{ width: '38%' }}>Year &amp; Branch</th>
                              <th style={{ width: '38%' }}>Register Number of Candidates</th>
                              <th style={{ width: '12%', textAlign: 'center' }}>No of Candidates</th>
                            </>
                          ) : (
                            <>
                              <th style={{ width: '30%' }}>Degree &amp; Branch</th>
                              <th style={{ width: '15%', textAlign: 'center' }}>Subject Code</th>
                              <th style={{ width: '33%' }}>Register Number of Candidates</th>
                              <th style={{ width: '10%', textAlign: 'center' }}>No of Candidates</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {activeHallData.summaryList?.map((s, idx) => (
                          <tr key={idx}>
                            {idx === 0 && (
                              <td
                                rowSpan={activeHallData.summaryList.length}
                                style={{
                                  textAlign: 'center',
                                  fontWeight: 800,
                                  fontSize: '15px',
                                  verticalAlign: 'middle',
                                  background: '#f8fafc',
                                  borderRight: '1px solid #e2e8f0',
                                }}
                              >
                                {activeHallData.hallNumber}
                              </td>
                            )}
                            {activeSession?.examType === 'INTERNAL' ? (
                              <>
                                <td style={{ fontWeight: 700 }}>{s.yearBranch}</td>
                                <td style={{ fontSize: '12px' }}>{s.registerNumbers}</td>
                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.count}</td>
                              </>
                            ) : (
                              <>
                                <td style={{ fontWeight: 700 }}>{s.degreeBranch}</td>
                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.subjectCode}</td>
                                <td style={{ fontSize: '12px' }}>{s.registerNumbers}</td>
                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.count}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PDF Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={handleDownloadSinglePdf}
                    disabled={pdfGenerating}
                  >
                    {pdfGenerating ? <RefreshCw size={15} className="spin" /> : <Download size={15} />}
                    {pdfGenerating ? 'Generating PDF...' : `Download Hall ${activeHallData.hallNumber} PDF`}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSuccess}`}
                    onClick={handleDownloadAllPdf}
                    disabled={pdfGenerating}
                  >
                    {pdfGenerating ? <RefreshCw size={15} className="spin" /> : <Download size={15} />}
                    {pdfGenerating ? 'Generating All PDFs...' : 'Download All Halls PDF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
            No seating allocation generated yet for this exam schedule. Click <strong>Generate Seating Allocation</strong> above.
          </div>
        )}
      </section>

      {/* ==================== 4. CANDIDATE SEAT SEARCH ==================== */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            <Search size={20} /> 4. Candidate Seat Lookup
          </h2>
        </div>

        <form onSubmit={handleSearchCandidate} style={{ display: 'flex', gap: '10px', maxWidth: '450px', marginBottom: '14px' }}>
          <input
            className={styles.input}
            placeholder="Enter Register Number (e.g. 23CSE001)"
            value={searchRegNo}
            onChange={(e) => setSearchRegNo(e.target.value)}
            required
          />
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={searchLoading}>
            {searchLoading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />} Search
          </button>
        </form>

        {searchResult && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '520px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#166534', marginBottom: '8px' }}>
              Seat Assigned: Hall {searchResult.hallNumber} - Seat #{String(searchResult.seatNo).padStart(2, '0')}
            </div>
            <div style={{ fontSize: '13.5px', color: '#14532d', lineHeight: '1.6' }}>
              <strong>Candidate:</strong> {searchResult.name} ({searchResult.registerNo})<br />
              <strong>Subject:</strong> {searchResult.subjectCode} - {searchResult.subjectName}<br />
              <strong>Schedule:</strong> {searchResult.examName} (Session: {searchResult.session})
            </div>
          </div>
        )}
      </section>

      {/* ==================== MODALS ==================== */}

      {/* Exam Masters Modal */}
      {showMasterModal && (
        <div className={styles.modalOverlay} onClick={() => setShowMasterModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className={styles.modalHeader}>
              <h3>Exam Masters / Reusable Series</h3>
              <button className={styles.modalClose} onClick={() => setShowMasterModal(false)}>
                ×
              </button>
            </div>

            {/* Create / Edit Master Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setMasterSaving(true);
                try {
                  if (editingMaster) {
                    await api.put(`/masters/${editingMaster._id}`, masterForm);
                    showAlert('success', 'Exam Master updated successfully.');
                  } else {
                    await api.post('/masters', masterForm);
                    showAlert('success', 'Exam Master saved successfully.');
                  }
                  setEditingMaster(null);
                  setMasterForm({
                    examType: 'ANNA_UNIVERSITY',
                    examCode: '',
                    examName: '',
                    centreCode: '9640',
                    centreName: 'Noorul Islam College of Engineering and Technology',
                  });
                  await fetchMasters();
                } catch (err) {
                  showAlert('error', err.response?.data?.message || 'Failed to save Exam Master.');
                } finally {
                  setMasterSaving(false);
                }
              }}
              style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}
            >
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Exam Type *</label>
                  <select
                    className={styles.select}
                    value={masterForm.examType}
                    onChange={(e) => setMasterForm({ ...masterForm, examType: e.target.value })}
                  >
                    <option value="ANNA_UNIVERSITY">Anna University Examination</option>
                    <option value="INTERNAL">Internal Examination</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Exam Name / Series Title *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. ANNA UNIVERSITY THEORY EXAMINATION NOV–DEC 2026"
                    value={masterForm.examName}
                    onChange={(e) => setMasterForm({ ...masterForm, examName: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>College Code</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 9640"
                    value={masterForm.centreCode}
                    onChange={(e) => setMasterForm({ ...masterForm, centreCode: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>College Name</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Noorul Islam College of Engineering and Technology"
                    value={masterForm.centreName}
                    onChange={(e) => setMasterForm({ ...masterForm, centreName: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                {editingMaster && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnOutline}`}
                    onClick={() => {
                      setEditingMaster(null);
                      setMasterForm({
                        examType: 'ANNA_UNIVERSITY',
                        examCode: '',
                        examName: '',
                        centreCode: '9640',
                        centreName: 'Noorul Islam College of Engineering and Technology',
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={masterSaving}>
                  {masterSaving ? (
                    <RefreshCw size={14} className="spin" />
                  ) : editingMaster ? (
                    <CheckCircle size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  {masterSaving ? 'Saving...' : editingMaster ? 'Update Master' : 'Save Master Series'}
                </button>
              </div>
            </form>

            {/* Masters List */}
            <div className={styles.tableWrapper} style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Series Name</th>
                    <th>College Code &amp; Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m) => (
                    <tr key={m._id}>
                      <td>
                        <span
                          className={styles.badge}
                          style={{
                            background: m.examType === 'INTERNAL' ? '#f3e8ff' : '#eff6ff',
                            color: m.examType === 'INTERNAL' ? '#6b21a8' : '#1e40af',
                          }}
                        >
                          {m.examType}
                        </span>
                      </td>
                      <td>
                        <strong>{m.examName}</strong>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {m.centreCode} – {m.centreName}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                            onClick={() => {
                              setEditingMaster(m);
                              setMasterForm({
                                examType: m.examType || 'ANNA_UNIVERSITY',
                                examCode: m.examCode || '',
                                examName: m.examName,
                                centreCode: m.centreCode || '9640',
                                centreName: m.centreName || 'Noorul Islam College of Engineering and Technology',
                              });
                            }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            onClick={async () => {
                              if (!window.confirm('Delete this exam master configuration?')) return;
                              try {
                                await api.delete(`/masters/${m._id}`);
                                showAlert('success', 'Exam master deleted.');
                                fetchMasters();
                              } catch (err) {
                                showAlert('error', err.response?.data?.message || 'Failed to delete.');
                              }
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All Exam Schedules Modal */}
      {showAllExamsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAllExamsModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div className={styles.modalHeader}>
              <h3>All Examination Schedules ({sessions.length})</h3>
              <button className={styles.modalClose} onClick={() => setShowAllExamsModal(false)}>
                ×
              </button>
            </div>

            <div className={styles.tableWrapper} style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Exam Series Name</th>
                    <th>Date &amp; Session</th>
                    <th>Candidates</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <span
                          className={styles.badge}
                          style={{
                            background: s.examType === 'INTERNAL' ? '#f3e8ff' : '#eff6ff',
                            color: s.examType === 'INTERNAL' ? '#6b21a8' : '#1e40af',
                          }}
                        >
                          {s.examType === 'INTERNAL' ? 'INTERNAL' : 'ANNA UNIV'}
                        </span>
                      </td>
                      <td>
                        <strong>{s.examName}</strong>
                      </td>
                      <td>
                        {new Date(s.examDate).toLocaleDateString('en-GB')} - <strong>{s.session}</strong>
                      </td>
                      <td>{s.candidateCount || 0}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${s.status === 'ALLOCATED' ? styles.badgeAllocated : styles.badgeDraft}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                            onClick={() => {
                              setSelectedSessionId(s._id);
                              setShowAllExamsModal(false);
                            }}
                          >
                            Select
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            onClick={() => handleDeleteSession(s._id)}
                            title="Delete Schedule"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  onChange={(e) =>
                    setEditingCandidate({ ...editingCandidate, registerNo: e.target.value })
                  }
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
                  <label>Degree Programme *</label>
                  <select
                    className={styles.select}
                    value={editingCandidate.programme || 'B.E.'}
                    onChange={(e) =>
                      setEditingCandidate({ ...editingCandidate, programme: e.target.value })
                    }
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
                    onChange={(e) =>
                      setEditingCandidate({ ...editingCandidate, department: e.target.value })
                    }
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
                  onChange={(e) =>
                    setEditingCandidate({ ...editingCandidate, subjectCode: e.target.value })
                  }
                  required
                />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                <label>Subject Name</label>
                <input
                  className={styles.input}
                  value={editingCandidate.subjectName || ''}
                  onChange={(e) =>
                    setEditingCandidate({ ...editingCandidate, subjectName: e.target.value })
                  }
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
              An allocation already exists for this examination schedule. Regenerating will replace
              the current seating arrangement across all selected halls for this date and session.
            </p>
            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setShowRegenerateModal(false)}
              >
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnWarning}`}
                onClick={handleRegenerateAllocation}
              >
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
              <button
                className={styles.modalClose}
                onClick={() => setShowDeleteAllocationModal(false)}
              >
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
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleDeleteAllocation}
              >
                Delete Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
