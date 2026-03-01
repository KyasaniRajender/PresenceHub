/* ============================================================
   EduTrack — Attendance Management System
   app.js | Version 1.0
   Modules: State, Router, Students, Sessions, Charts, UI
   ============================================================ */

'use strict';

/* =====================================================
   MODULE: STATE MANAGEMENT
   Single source of truth — localStorage persistent
===================================================== */
const State = (() => {
  const STORAGE_KEY = 'edutrack_v1';

  const defaults = {
    students: [],
    sessions: [],
    settings: {
      instituteName: 'Government Institute of Technology',
      instituteCode: 'GIT-2024',
      minAttendance: 75,
      alertThreshold: 80,
      enableLate: true,
      enableEmailAlerts: false,
      enableAutoSubmit: false,
      theme: 'dark',
      accent: '#4F7CFF',
    },
  };

  let state = { ...defaults };

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...defaults, ...parsed };
        state.settings = { ...defaults.settings, ...parsed.settings };
      }
    } catch (e) {
      console.warn('EduTrack: Failed to load state', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('EduTrack: Failed to save state', e);
    }
  }

  function get() { return state; }

  function set(updater) {
    if (typeof updater === 'function') updater(state);
    else Object.assign(state, updater);
    save();
  }

  function clear() {
    state = { ...defaults };
    save();
  }

  return { load, save, get, set, clear };
})();

/* =====================================================
   MODULE: UTILITIES
===================================================== */
const Utils = {
  id: (selector) => document.getElementById(selector),
  qs: (selector, ctx = document) => ctx.querySelector(selector),
  qsa: (selector, ctx = document) => [...ctx.querySelectorAll(selector)],

  formatDate: (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  today: () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  },

  todayFull: () => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },

  uuid: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  initials: (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  pct: (a, b) => {
    if (!b || b === 0) return 0;
    return Math.round((a / b) * 100);
  },

  pctColor: (pct) => {
    if (pct >= 85) return 'high';
    if (pct >= 75) return 'medium';
    return 'low';
  },

  escapeHtml: (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  },

  debounce: (fn, delay = 250) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  animateCounter: (el, target, duration = 800) => {
    const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
    const isPercent = el.textContent.includes('%');
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(start + (target - start) * eased);
      el.textContent = isPercent ? value + '%' : value;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  },
};

/* =====================================================
   MODULE: TOAST NOTIFICATIONS
===================================================== */
const Toast = {
  icons: {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  },

  show(message, type = 'info', duration = 3500) {
    const container = Utils.id('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="toast__icon">${this.icons[type]}</span>
      <span>${Utils.escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'none';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 350);
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  info:    (msg) => Toast.show(msg, 'info'),
};

/* =====================================================
   MODULE: MODAL MANAGER
===================================================== */
const Modal = {
  open(id) {
    const modal = Utils.id(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Close on backdrop
    Utils.qsa('[data-close-modal]', modal).forEach((el) => {
      el.addEventListener('click', () => Modal.close(id), { once: true });
    });

    // Focus trap
    const focusable = Utils.qsa(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])', modal
    );
    if (focusable[0]) focusable[0].focus();
  },

  close(id) {
    const modal = Utils.id(id);
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  },

  confirm(message, onConfirm) {
    const modal = Utils.id('confirmModal');
    Utils.id('confirmModalText').textContent = message;
    this.open('confirmModal');

    const btn = Utils.id('confirmModalAction');
    const handler = () => {
      this.close('confirmModal');
      onConfirm();
    };
    btn.addEventListener('click', handler, { once: true });
  },
};

/* =====================================================
   MODULE: ROUTER (SPA Navigation)
===================================================== */
const Router = {
  currentPage: 'dashboard',

  init() {
    Utils.qsa('.sidebar__nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (target) this.navigate(target);
      });
    });

    Utils.id('viewAllSessionsBtn')?.addEventListener('click', () => this.navigate('reports'));
    Utils.id('quickAttendBtn')?.addEventListener('click', () => this.navigate('take-attendance'));
  },

  navigate(page) {
    if (this.currentPage === page) return;

    // Hide all pages
    Utils.qsa('.page').forEach((p) => {
      p.hidden = true;
      p.classList.remove('page--active');
    });

    // Show target page
    const target = Utils.id(`page-${page}`);
    if (!target) return;
    target.hidden = false;
    target.classList.add('page--active');
    this.currentPage = page;

    // Update nav
    Utils.qsa('.sidebar__nav-item').forEach((item) => {
      item.classList.remove('sidebar__nav-item--active');
    });
    const activeItem = Utils.qs(`[data-page="${page}"]`);
    if (activeItem) activeItem.classList.add('sidebar__nav-item--active');

    // Update ARIA
    Utils.qsa('.sidebar__nav-btn').forEach((btn) => {
      btn.removeAttribute('aria-current');
      if (btn.dataset.target === page) btn.setAttribute('aria-current', 'page');
    });

    // Close mobile sidebar
    Sidebar.closeMobile();

    // Page-specific init
    if (page === 'dashboard') Dashboard.refresh();
    if (page === 'students')  Students.renderTable();
    if (page === 'reports')   Reports.render();
    if (page === 'settings')  Settings.init();
  },
};

/* =====================================================
   MODULE: SIDEBAR
===================================================== */
const Sidebar = {
  collapsed: false,

  init() {
    const collapseBtn = Utils.id('sidebarCollapseBtn');
    const mobileBtn = Utils.id('mobileMenuBtn');
    const overlay = Utils.id('sidebarOverlay');
    const sidebar = Utils.id('sidebar');

    collapseBtn?.addEventListener('click', () => this.toggle());

    mobileBtn?.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('sidebar--mobile-open');
      if (isOpen) this.closeMobile();
      else this.openMobile();
    });

    overlay?.addEventListener('click', () => this.closeMobile());
  },

  toggle() {
    const sidebar = Utils.id('sidebar');
    this.collapsed = !this.collapsed;
    sidebar.classList.toggle('sidebar--collapsed', this.collapsed);
  },

  openMobile() {
    const sidebar = Utils.id('sidebar');
    const overlay = Utils.id('sidebarOverlay');
    const btn = Utils.id('mobileMenuBtn');
    sidebar.classList.add('sidebar--mobile-open');
    overlay.classList.add('active');
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
    Utils.id('sidebarOverlay').removeAttribute('aria-hidden');
  },

  closeMobile() {
    const sidebar = Utils.id('sidebar');
    const overlay = Utils.id('sidebarOverlay');
    const btn = Utils.id('mobileMenuBtn');
    sidebar.classList.remove('sidebar--mobile-open');
    overlay.classList.remove('active');
    btn?.classList.remove('active');
    btn?.setAttribute('aria-expanded', 'false');
    Utils.id('sidebarOverlay').setAttribute('aria-hidden', 'true');
  },
};

/* =====================================================
   MODULE: STUDENT MANAGEMENT
===================================================== */
const Students = {
  currentPage: 1,
  perPage: 10,
  sortCol: 'name',
  sortDir: 'asc',
  filterClass: '',
  filterSemester: '',
  query: '',

  init() {
    Utils.id('addStudentBtn')?.addEventListener('click', () => this.openModal());
    Utils.id('saveStudentBtn')?.addEventListener('click', () => this.save());
    Utils.id('studentListSearch')?.addEventListener(
      'input',
      Utils.debounce((e) => {
        this.query = e.target.value.toLowerCase();
        this.currentPage = 1;
        this.renderTable();
      }, 200)
    );
    Utils.id('filterClass')?.addEventListener('change', (e) => {
      this.filterClass = e.target.value;
      this.currentPage = 1;
      this.renderTable();
    });
    Utils.id('filterSemester')?.addEventListener('change', (e) => {
      this.filterSemester = e.target.value;
      this.currentPage = 1;
      this.renderTable();
    });
    Utils.id('prevPageBtn')?.addEventListener('click', () => {
      if (this.currentPage > 1) { this.currentPage--; this.renderTable(); }
    });
    Utils.id('nextPageBtn')?.addEventListener('click', () => {
      const pages = this.totalPages();
      if (this.currentPage < pages) { this.currentPage++; this.renderTable(); }
    });

    // Sort
    Utils.qsa('.sortable', Utils.id('studentsTable')).forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (this.sortCol === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        else { this.sortCol = col; this.sortDir = 'asc'; }
        this.renderTable();
      });
    });

    Utils.id('importStudentsBtn')?.addEventListener('click', () => {
      Utils.id('csvImportInput').click();
    });

    Utils.id('csvImportInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.importCSV(file);
    });
  },

  getAll() {
    return State.get().students;
  },

  getFiltered() {
    let students = this.getAll();

    if (this.query) {
      students = students.filter(
        (s) =>
          s.name.toLowerCase().includes(this.query) ||
          s.rollNo.toLowerCase().includes(this.query) ||
          s.class.toLowerCase().includes(this.query)
      );
    }

    if (this.filterClass) students = students.filter((s) => s.class === this.filterClass);
    if (this.filterSemester) students = students.filter((s) => s.semester == this.filterSemester);

    students = students.sort((a, b) => {
      let va = a[this.sortCol] ?? '';
      let vb = b[this.sortCol] ?? '';
      if (this.sortCol === 'attendance') { va = this.getAttPct(a.id); vb = this.getAttPct(b.id); }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return students;
  },

  totalPages() {
    return Math.max(1, Math.ceil(this.getFiltered().length / this.perPage));
  },

  getAttPct(studentId) {
    const sessions = State.get().sessions;
    let present = 0, total = 0;
    sessions.forEach((s) => {
      const rec = s.records.find((r) => r.studentId === studentId);
      if (rec) { total++; if (rec.status === 'present') present++; }
    });
    return Utils.pct(present, total);
  },

  renderTable() {
    const filtered = this.getFiltered();
    const total = filtered.length;
    const start = (this.currentPage - 1) * this.perPage;
    const page = filtered.slice(start, start + this.perPage);
    const tbody = Utils.id('studentsTableBody');

    Utils.id('studentCount').textContent = `${total} student${total !== 1 ? 's' : ''}`;

    if (page.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty">
            <div class="table-empty__inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <span>No students match your filters.</span>
            </div>
          </td>
        </tr>`;
      this.updatePagination(0);
      return;
    }

    tbody.innerHTML = page.map((s) => {
      const pct = this.getAttPct(s.id);
      const pctClass = Utils.pctColor(pct);
      const statusBadge = pct >= 75
        ? `<span class="badge badge--green">Active</span>`
        : `<span class="badge badge--red">Low Att.</span>`;
      return `
        <tr>
          <td><strong>${Utils.escapeHtml(s.rollNo)}</strong></td>
          <td>${Utils.escapeHtml(s.name)}</td>
          <td><span class="badge badge--accent">${Utils.escapeHtml(s.class)}</span></td>
          <td>Sem ${Utils.escapeHtml(s.semester)}</td>
          <td>${s.email ? Utils.escapeHtml(s.email) : '<span style="color:rgba(255,255,255,0.2)">—</span>'}</td>
          <td>
            <div class="att-pct">
              <div class="att-pct__bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div class="att-pct__fill att-pct__fill--${pctClass}" style="width:${pct}%"></div>
              </div>
              <span>${pct}%</span>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button class="icon-btn" data-action="edit" data-id="${s.id}" aria-label="Edit ${Utils.escapeHtml(s.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${s.id}" aria-label="Delete ${Utils.escapeHtml(s.name)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        if (action === 'edit') this.openModal(id);
        if (action === 'delete') this.remove(id);
      });
    });

    this.updatePagination(total);
  },

  updatePagination(total) {
    const pages = this.totalPages();
    Utils.id('paginationInfo').textContent = `Page ${this.currentPage} of ${pages}`;
    Utils.id('prevPageBtn').disabled = this.currentPage <= 1;
    Utils.id('nextPageBtn').disabled = this.currentPage >= pages;
  },

  openModal(id = null) {
    const form = Utils.id('studentForm');
    form.reset();
    Utils.id('studentId').value = '';
    Utils.id('studentModalTitle').textContent = 'Add Student';
    Utils.qsa('.form-error', form).forEach((e) => (e.textContent = ''));

    if (id) {
      const student = this.getAll().find((s) => s.id === id);
      if (!student) return;
      Utils.id('studentModalTitle').textContent = 'Edit Student';
      Utils.id('studentId').value = student.id;
      Utils.id('studentRollNo').value = student.rollNo;
      Utils.id('studentName').value = student.name;
      Utils.id('studentClass').value = student.class;
      Utils.id('studentSemester').value = student.semester;
      Utils.id('studentEmail').value = student.email || '';
      Utils.id('studentPhone').value = student.phone || '';
      Utils.id('studentDOB').value = student.dob || '';
      Utils.id('studentGender').value = student.gender || '';
    }

    Modal.open('studentModal');
  },

  save() {
    // Validate
    let valid = true;
    const rollNo = Utils.id('studentRollNo').value.trim();
    const name = Utils.id('studentName').value.trim();
    const cls = Utils.id('studentClass').value;

    if (!rollNo) { Utils.id('rollNoError').textContent = 'Roll number is required.'; valid = false; }
    else Utils.id('rollNoError').textContent = '';

    if (!name) { Utils.id('nameError').textContent = 'Full name is required.'; valid = false; }
    else Utils.id('nameError').textContent = '';

    if (!cls) { Utils.id('classError').textContent = 'Class is required.'; valid = false; }
    else Utils.id('classError').textContent = '';

    if (!valid) return;

    const editId = Utils.id('studentId').value;
    const student = {
      id: editId || Utils.uuid(),
      rollNo,
      name,
      class: cls,
      semester: Utils.id('studentSemester').value,
      email: Utils.id('studentEmail').value.trim(),
      phone: Utils.id('studentPhone').value.trim(),
      dob: Utils.id('studentDOB').value,
      gender: Utils.id('studentGender').value,
      createdAt: editId ? undefined : new Date().toISOString(),
    };

    State.set((s) => {
      if (editId) {
        const idx = s.students.findIndex((st) => st.id === editId);
        if (idx >= 0) { student.createdAt = s.students[idx].createdAt; s.students[idx] = student; }
      } else {
        // Check duplicate roll no
        const dup = s.students.find((st) => st.rollNo.toLowerCase() === rollNo.toLowerCase() && st.id !== editId);
        if (dup) { Utils.id('rollNoError').textContent = 'Roll number already exists.'; return; }
        s.students.push(student);
      }
    });

    Modal.close('studentModal');
    this.renderTable();
    Dashboard.refresh();
    Toast.success(editId ? 'Student updated successfully.' : 'Student added successfully.');
  },

  remove(id) {
    const student = this.getAll().find((s) => s.id === id);
    if (!student) return;
    Modal.confirm(`Delete student "${student.name}"? This will also remove their attendance records.`, () => {
      State.set((s) => {
        s.students = s.students.filter((st) => st.id !== id);
        s.sessions = s.sessions.map((sess) => ({
          ...sess,
          records: sess.records.filter((r) => r.studentId !== id),
        }));
      });
      this.renderTable();
      Dashboard.refresh();
      Toast.success('Student removed.');
    });
  },

  importCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      let added = 0;

      lines.slice(1).forEach((line) => {
        const vals = line.split(',').map((v) => v.trim());
        const obj = {};
        headers.forEach((h, i) => (obj[h] = vals[i] || ''));

        if (!obj.rollno && !obj['roll no'] && !obj.roll_no) return;
        if (!obj.name) return;

        const student = {
          id: Utils.uuid(),
          rollNo: obj.rollno || obj['roll no'] || obj.roll_no,
          name: obj.name,
          class: obj.class || obj['class/section'] || 'CS-A',
          semester: obj.semester || '1',
          email: obj.email || '',
          phone: obj.phone || '',
          dob: '',
          gender: '',
          createdAt: new Date().toISOString(),
        };

        State.set((s) => {
          const dup = s.students.find((st) => st.rollNo.toLowerCase() === student.rollNo.toLowerCase());
          if (!dup) { s.students.push(student); added++; }
        });
      });

      this.renderTable();
      Dashboard.refresh();
      Toast.success(`Imported ${added} student${added !== 1 ? 's' : ''}.`);
    };
    reader.readAsText(file);
  },
};

/* =====================================================
   MODULE: SESSION / ATTENDANCE
===================================================== */
const Attendance = {
  activeSession: null,
  records: {},   // { studentId: 'present'|'absent'|'unmarked' }
  allStudents: [],

  init() {
    // Set default date
    Utils.id('sessionDate').value = Utils.today();

    Utils.id('sessionForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.startSession();
    });

    Utils.id('markAllPresentBtn')?.addEventListener('click', () => this.markAll('present'));
    Utils.id('markAllAbsentBtn')?.addEventListener('click', () => this.markAll('absent'));
    Utils.id('cancelSessionBtn')?.addEventListener('click', () => this.cancelSession());
    Utils.id('submitAttendanceBtn')?.addEventListener('click', () => this.submitSession());

    Utils.id('studentSearch')?.addEventListener(
      'input',
      Utils.debounce((e) => this.renderGrid(e.target.value.toLowerCase()), 200)
    );

    Utils.qsa('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Utils.qsa('.filter-btn').forEach((b) => b.classList.remove('filter-btn--active'));
        btn.classList.add('filter-btn--active');
        this.renderGrid(Utils.id('studentSearch')?.value.toLowerCase() || '', btn.dataset.filter);
      });
    });
  },

  startSession() {
    const cls = Utils.id('sessionClass').value;
    const subject = Utils.id('sessionSubject').value;
    const date = Utils.id('sessionDate').value;
    const period = Utils.id('sessionPeriod').value;
    let valid = true;

    if (!cls) { Utils.id('sessionClassError').textContent = 'Select a class.'; valid = false; }
    else Utils.id('sessionClassError').textContent = '';

    if (!subject) { Utils.id('sessionSubjectError').textContent = 'Select a subject.'; valid = false; }
    else Utils.id('sessionSubjectError').textContent = '';

    if (!date) { Utils.id('sessionDateError').textContent = 'Select a date.'; valid = false; }
    else Utils.id('sessionDateError').textContent = '';

    if (!valid) return;

    // Get students in this class
    this.allStudents = State.get().students.filter((s) => s.class === cls);

    if (this.allStudents.length === 0) {
      Toast.error('No students found in this class. Add students first.');
      return;
    }

    this.activeSession = {
      id: Utils.uuid(),
      class: cls,
      subject,
      date,
      period,
      createdAt: new Date().toISOString(),
    };

    // Initialize all as unmarked
    this.records = {};
    this.allStudents.forEach((s) => (this.records[s.id] = 'unmarked'));

    // Show toolbar and grid
    Utils.id('attendanceToolbar').hidden = false;
    Utils.id('attendanceSubmit').hidden = false;

    // Update status
    const statusEl = Utils.id('sessionStatus');
    statusEl.innerHTML = `<span class="status-dot status-dot--active"></span> Active Session`;

    this.renderGrid();
    this.updateSummary();
    Toast.info(`Session started for ${cls} — ${subject}`);
  },

  renderGrid(query = '', filter = 'all') {
    const grid = Utils.id('attendanceGrid');
    let students = this.allStudents;

    if (query) {
      students = students.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.rollNo.toLowerCase().includes(query)
      );
    }

    if (filter !== 'all') {
      students = students.filter((s) => this.records[s.id] === filter);
    }

    if (students.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.3);padding:2rem">No students match your search.</div>`;
      return;
    }

    grid.innerHTML = students.map((s) => {
      const status = this.records[s.id] || 'unmarked';
      const initials = Utils.initials(s.name);
      return `
        <div class="student-card student-card--${status}" data-id="${s.id}" role="listitem" tabindex="0"
             aria-label="${Utils.escapeHtml(s.name)}, ${status}">
          <div class="student-card__avatar">${initials}</div>
          <div class="student-card__info">
            <div class="student-card__name">${Utils.escapeHtml(s.name)}</div>
            <div class="student-card__roll">${Utils.escapeHtml(s.rollNo)}</div>
          </div>
          <div class="student-card__toggle">
            <button class="attendance-btn attendance-btn--present${status === 'present' ? ' active' : ''}"
                    data-sid="${s.id}" data-status="present" aria-label="Mark present">P</button>
            <button class="attendance-btn attendance-btn--absent${status === 'absent' ? ' active' : ''}"
                    data-sid="${s.id}" data-status="absent" aria-label="Mark absent">A</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach card events
    grid.querySelectorAll('.student-card').forEach((card) => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') this.mark(card.dataset.id, 'present');
        if (e.key === 'a' || e.key === 'A') this.mark(card.dataset.id, 'absent');
      });
    });

    grid.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.mark(btn.dataset.sid, btn.dataset.status);
      });
    });
  },

  mark(studentId, status) {
    const current = this.records[studentId];
    this.records[studentId] = current === status ? 'unmarked' : status;

    // Update card appearance
    const card = Utils.qs(`.student-card[data-id="${studentId}"]`);
    if (card) {
      card.className = `student-card student-card--${this.records[studentId]}`;
      card.setAttribute('aria-label', `${card.querySelector('.student-card__name').textContent}, ${this.records[studentId]}`);
      card.querySelectorAll('.attendance-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.status === this.records[studentId]);
      });
    }

    this.updateSummary();
  },

  markAll(status) {
    Object.keys(this.records).forEach((id) => (this.records[id] = status));
    this.renderGrid(Utils.id('studentSearch')?.value.toLowerCase() || '');
    this.updateSummary();
  },

  updateSummary() {
    const values = Object.values(this.records);
    const present = values.filter((v) => v === 'present').length;
    const absent = values.filter((v) => v === 'absent').length;
    const unmarked = values.filter((v) => v === 'unmarked').length;
    const total = values.length;
    const marked = present + absent;

    Utils.id('submitPresent').textContent = present;
    Utils.id('submitAbsent').textContent = absent;
    Utils.id('submitUnmarked').textContent = unmarked;

    Utils.id('attendanceProgressText').textContent = `${marked} / ${total} marked`;
    const pct = Utils.pct(marked, total);
    const bar = Utils.id('attendanceProgressBar');
    bar.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', pct);
  },

  submitSession() {
    if (!this.activeSession) return;

    const values = Object.values(this.records);
    const unmarked = values.filter((v) => v === 'unmarked').length;

    if (unmarked > 0) {
      Modal.confirm(
        `${unmarked} student(s) are still unmarked. Submit anyway? Unmarked students will be marked absent.`,
        () => this.doSubmit()
      );
    } else {
      this.doSubmit();
    }
  },

  doSubmit() {
    // Mark unmarked as absent
    Object.keys(this.records).forEach((id) => {
      if (this.records[id] === 'unmarked') this.records[id] = 'absent';
    });

    const session = {
      ...this.activeSession,
      records: Object.entries(this.records).map(([studentId, status]) => ({ studentId, status })),
    };

    State.set((s) => s.sessions.push(session));

    this.resetSession();
    Dashboard.refresh();
    Toast.success('Attendance submitted successfully!');
    Router.navigate('dashboard');
  },

  cancelSession() {
    Modal.confirm('Cancel this attendance session? All markings will be lost.', () => {
      this.resetSession();
      Toast.info('Session cancelled.');
    });
  },

  resetSession() {
    this.activeSession = null;
    this.records = {};
    this.allStudents = [];

    Utils.id('sessionForm').reset();
    Utils.id('sessionDate').value = Utils.today();
    Utils.id('attendanceGrid').innerHTML = '';
    Utils.id('attendanceToolbar').hidden = true;
    Utils.id('attendanceSubmit').hidden = true;

    const statusEl = Utils.id('sessionStatus');
    statusEl.innerHTML = `<span class="status-dot status-dot--idle"></span> Not Started`;
  },
};

/* =====================================================
   MODULE: DASHBOARD
===================================================== */
const Dashboard = {
  chartInstance: null,

  init() {
    Utils.id('dashDate').textContent = Utils.todayFull();
    Utils.id('exportBtn')?.addEventListener('click', () => this.exportData());
    Utils.id('dismissAlertBtn')?.addEventListener('click', () => {
      Utils.id('lowAttendanceAlert').hidden = true;
    });
    this.refresh();
  },

  refresh() {
    const { students, sessions } = State.get();
    const today = Utils.today();

    // Today's sessions
    const todaySessions = sessions.filter((s) => s.date === today);

    let todayPresent = 0;
    let todayAbsent = 0;

    todaySessions.forEach((sess) => {
      sess.records.forEach((r) => {
        if (r.status === 'present') todayPresent++;
        if (r.status === 'absent') todayAbsent++;
      });
    });

    // All time avg rate
    let allPresent = 0, allTotal = 0;
    sessions.forEach((s) => s.records.forEach((r) => { allTotal++; if (r.status === 'present') allPresent++; }));
    const avgRate = Utils.pct(allPresent, allTotal);

    // Animate counters
    const statTotal = Utils.id('statTotalStudents');
    const statPresent = Utils.id('statPresent');
    const statAbsent = Utils.id('statAbsent');
    const statRate = Utils.id('statRate');

    Utils.animateCounter(statTotal, students.length);
    Utils.animateCounter(statPresent, todayPresent);
    Utils.animateCounter(statAbsent, todayAbsent);

    // Rate
    const prev = parseInt(statRate.textContent) || 0;
    const start = performance.now();
    const dur = 800;
    const animRate = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      statRate.textContent = Math.round(prev + (avgRate - prev) * e) + '%';
      if (p < 1) requestAnimationFrame(animRate);
    };
    requestAnimationFrame(animRate);

    const todayTot = todayPresent + todayAbsent;
    Utils.id('statPresentPct').textContent = Utils.pct(todayPresent, todayTot) + '% of today';
    Utils.id('statAbsentPct').textContent = Utils.pct(todayAbsent, todayTot) + '% of today';
    Utils.id('statStudentTrend').textContent = `${students.length} enrolled`;

    this.renderRecentSessions(sessions);
    this.renderWeeklyChart(sessions);
    this.checkLowAttendance(students, sessions);
  },

  renderRecentSessions(sessions) {
    const list = Utils.id('recentSessionList');
    const recent = [...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    if (recent.length === 0) {
      list.innerHTML = `<li class="session-list__empty">No sessions yet. Start taking attendance!</li>`;
      return;
    }

    list.innerHTML = recent.map((s) => {
      const total = s.records.length;
      const present = s.records.filter((r) => r.status === 'present').length;
      const pct = Utils.pct(present, total);
      return `
        <li class="session-list__item">
          <div class="session-list__dot"></div>
          <div class="session-list__info">
            <div class="session-list__title">${Utils.escapeHtml(s.class)} — ${Utils.escapeHtml(s.subject)}</div>
            <div class="session-list__meta">${Utils.formatDate(s.date)} · Period ${s.period}</div>
          </div>
          <div class="session-list__rate">${pct}%</div>
        </li>
      `;
    }).join('');
  },

  renderWeeklyChart(sessions) {
    const canvas = Utils.id('weeklyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Get last 7 days
    const today = new Date();
    const labels = [];
    const presentData = [];
    const absentData = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
      labels.push(dayLabel);

      let p = 0, a = 0;
      sessions.filter((s) => s.date === dateStr).forEach((s) => {
        s.records.forEach((r) => { if (r.status === 'present') p++; else a++; });
      });
      presentData.push(p);
      absentData.push(a);
    }

    // Simple custom canvas chart
    this.drawBarChart(ctx, canvas, labels, presentData, absentData);
  },

  drawBarChart(ctx, canvas, labels, presentData, absentData) {
    const W = canvas.offsetWidth || 600;
    const H = 220;
    canvas.width = W;
    canvas.height = H;

    const padL = 40, padR = 20, padT = 20, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...presentData, ...absentData, 1);
    const gridLines = 4;
    const barGroupW = chartW / labels.length;
    const barW = Math.min(barGroupW * 0.3, 28);
    const gap = barW * 0.4;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      const val = Math.round(maxVal - (maxVal / gridLines) * i);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '10px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, padL - 6, y + 4);
    }

    // Bars
    labels.forEach((label, i) => {
      const x = padL + barGroupW * i + barGroupW / 2;

      // Present bar
      const pH = (presentData[i] / maxVal) * chartH;
      const pY = padT + chartH - pH;

      const gP = ctx.createLinearGradient(0, pY, 0, padT + chartH);
      gP.addColorStop(0, '#4F7CFF');
      gP.addColorStop(1, 'rgba(79,124,255,0.3)');
      ctx.fillStyle = gP;
      ctx.beginPath();
      ctx.roundRect(x - gap / 2 - barW, pY, barW, pH, [3, 3, 0, 0]);
      ctx.fill();

      // Absent bar
      const aH = (absentData[i] / maxVal) * chartH;
      const aY = padT + chartH - aH;

      const gA = ctx.createLinearGradient(0, aY, 0, padT + chartH);
      gA.addColorStop(0, '#EF4444');
      gA.addColorStop(1, 'rgba(239,68,68,0.3)');
      ctx.fillStyle = gA;
      ctx.beginPath();
      ctx.roundRect(x + gap / 2, aY, barW, aH, [3, 3, 0, 0]);
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, H - padB + 16);
    });
  },

  checkLowAttendance(students, sessions) {
    const threshold = State.get().settings.alertThreshold;
    const lowStudents = students.filter((s) => {
      let present = 0, total = 0;
      sessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === s.id);
        if (rec) { total++; if (rec.status === 'present') present++; }
      });
      if (total === 0) return false;
      return Utils.pct(present, total) < threshold;
    });

    const alertEl = Utils.id('lowAttendanceAlert');
    if (lowStudents.length > 0) {
      alertEl.hidden = false;
      Utils.id('lowAttendanceText').textContent =
        `${lowStudents.length} student(s) have attendance below ${threshold}%.`;
    } else {
      alertEl.hidden = true;
    }
  },

  exportData() {
    const { students, sessions } = State.get();
    let csv = 'Roll No,Name,Class,Semester,Total Classes,Present,Absent,Attendance %\n';

    students.forEach((s) => {
      let present = 0, total = 0;
      sessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === s.id);
        if (rec) { total++; if (rec.status === 'present') present++; }
      });
      csv += `${s.rollNo},${s.name},${s.class},${s.semester},${total},${present},${total - present},${Utils.pct(present, total)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${Utils.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Export downloaded.');
  },
};

/* =====================================================
   MODULE: REPORTS
===================================================== */
const Reports = {
  init() {
    Utils.id('reportFilterForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.render();
    });
    Utils.id('exportCSVBtn')?.addEventListener('click', () => Dashboard.exportData());
    Utils.id('generateReportBtn')?.addEventListener('click', () => this.render());
  },

  render() {
    const { students, sessions } = State.get();
    const cls = Utils.id('reportClass')?.value || '';
    const subject = Utils.id('reportSubject')?.value || '';
    const from = Utils.id('reportFrom')?.value || '';
    const to = Utils.id('reportTo')?.value || '';

    let filteredSessions = sessions;
    if (cls) filteredSessions = filteredSessions.filter((s) => s.class === cls);
    if (subject) filteredSessions = filteredSessions.filter((s) => s.subject === subject);
    if (from) filteredSessions = filteredSessions.filter((s) => s.date >= from);
    if (to) filteredSessions = filteredSessions.filter((s) => s.date <= to);

    let filteredStudents = students;
    if (cls) filteredStudents = filteredStudents.filter((s) => s.class === cls);

    const tbody = Utils.id('reportTableBody');

    if (filteredStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><div class="table-empty__inner"><span>No data for selected filters.</span></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filteredStudents.map((s) => {
      let present = 0, total = 0;
      filteredSessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === s.id);
        if (rec) { total++; if (rec.status === 'present') present++; }
      });
      const pct = Utils.pct(present, total);
      const statusBadge = pct >= 75
        ? `<span class="badge badge--green">Good</span>`
        : total === 0
          ? `<span class="badge badge--amber">No Data</span>`
          : `<span class="badge badge--red">Low</span>`;

      return `
        <tr>
          <td>${Utils.escapeHtml(s.rollNo)}</td>
          <td>${Utils.escapeHtml(s.name)}</td>
          <td><span class="badge badge--accent">${Utils.escapeHtml(s.class)}</span></td>
          <td>${total}</td>
          <td style="color:var(--color-green)">${present}</td>
          <td style="color:var(--color-red)">${total - present}</td>
          <td>
            <div class="att-pct">
              <div class="att-pct__bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div class="att-pct__fill att-pct__fill--${Utils.pctColor(pct)}" style="width:${pct}%"></div>
              </div>
              <strong>${pct}%</strong>
            </div>
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    Toast.success('Report generated.');
  },
};

/* =====================================================
   MODULE: SETTINGS
===================================================== */
const Settings = {
  init() {
    const s = State.get().settings;

    Utils.id('instName').value = s.instituteName;
    Utils.id('instCode').value = s.instituteCode;
    Utils.id('instEmail').value = s.adminEmail || 'admin@git.edu.in';
    Utils.id('minAttendance').value = s.minAttendance;
    Utils.id('alertThreshold').value = s.alertThreshold;
    Utils.id('enableLate').checked = s.enableLate;
    Utils.id('enableEmailAlerts').checked = s.enableEmailAlerts;
    Utils.id('enableAutoSubmit').checked = s.enableAutoSubmit;

    Utils.id('saveInstInfoBtn')?.addEventListener('click', () => {
      State.set((st) => {
        st.settings.instituteName = Utils.id('instName').value;
        st.settings.instituteCode = Utils.id('instCode').value;
        st.settings.adminEmail = Utils.id('instEmail').value;
      });
      Toast.success('Institute info saved.');
    });

    Utils.id('saveRulesBtn')?.addEventListener('click', () => {
      State.set((st) => {
        st.settings.minAttendance = parseInt(Utils.id('minAttendance').value);
        st.settings.alertThreshold = parseInt(Utils.id('alertThreshold').value);
        st.settings.enableLate = Utils.id('enableLate').checked;
        st.settings.enableEmailAlerts = Utils.id('enableEmailAlerts').checked;
        st.settings.enableAutoSubmit = Utils.id('enableAutoSubmit').checked;
      });
      Toast.success('Rules saved.');
    });

    Utils.id('clearDataBtn')?.addEventListener('click', () => {
      Modal.confirm('Delete ALL attendance records? Student list will be preserved.', () => {
        State.set((st) => { st.sessions = []; });
        Dashboard.refresh();
        Toast.success('Attendance data cleared.');
      });
    });

    Utils.id('exportAllDataBtn')?.addEventListener('click', () => Dashboard.exportData());
    Utils.id('importDataBtn')?.addEventListener('click', () => Utils.id('csvImportInput').click());

    // Theme buttons
    Utils.qsa('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Utils.qsa('.theme-btn').forEach((b) => { b.classList.remove('theme-btn--active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('theme-btn--active');
        btn.setAttribute('aria-pressed', 'true');
        State.set((st) => { st.settings.theme = btn.dataset.theme; });
      });
    });

    // Color swatches
    Utils.qsa('.color-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        Utils.qsa('.color-swatch').forEach((s) => { s.classList.remove('color-swatch--active'); s.setAttribute('aria-pressed', 'false'); });
        swatch.classList.add('color-swatch--active');
        swatch.setAttribute('aria-pressed', 'true');
        const color = swatch.dataset.color;
        document.documentElement.style.setProperty('--color-accent', color);
        State.set((st) => { st.settings.accent = color; });
      });
    });
  },
};

/* =====================================================
   MODULE: SEED DATA (demo population)
===================================================== */
function seedDemoData() {
  const { students, sessions } = State.get();
  if (students.length > 0) return;

  const names = [
    'Aarav Sharma', 'Priya Patel', 'Rohan Gupta', 'Sneha Reddy', 'Arjun Mehta',
    'Kavya Nair', 'Vikram Singh', 'Ananya Iyer', 'Dev Joshi', 'Riya Kapoor',
    'Karan Verma', 'Pooja Trivedi', 'Harsh Mishra', 'Divya Malhotra', 'Rahul Agarwal',
    'Simran Kaur', 'Amit Desai', 'Nisha Bose', 'Varun Pandey', 'Aisha Khan',
  ];

  const seedStudents = names.map((name, i) => ({
    id: Utils.uuid(),
    rollNo: `CS-A-${String(i + 1).padStart(3, '0')}`,
    name,
    class: 'CS-A',
    semester: '4',
    email: name.split(' ')[0].toLowerCase() + '@git.edu.in',
    phone: `+91 98765 ${String(40000 + i).padStart(5, '0')}`,
    dob: '',
    gender: i % 2 === 0 ? 'male' : 'female',
    createdAt: new Date().toISOString(),
  }));

  State.set((s) => { s.students = seedStudents; });

  // Create a few sample sessions
  const today = new Date();
  [1, 2, 3, 4, 5].forEach((daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split('T')[0];

    const session = {
      id: Utils.uuid(),
      class: 'CS-A',
      subject: daysAgo % 2 === 0 ? 'DSA' : 'DBMS',
      date: dateStr,
      period: String((daysAgo % 3) + 1),
      createdAt: d.toISOString(),
      records: seedStudents.map((st) => ({
        studentId: st.id,
        status: Math.random() > 0.2 ? 'present' : 'absent',
      })),
    };

    State.set((s) => { s.sessions.push(session); });
  });
}

/* =====================================================
   BOOT
===================================================== */
function boot() {
  State.load();
  seedDemoData();

  Sidebar.init();
  Router.init();
  Dashboard.init();
  Attendance.init();
  Students.init();
  Reports.init();

  // Initial page render
  Students.renderTable();
  Reports.render();

  // Apply saved accent color
  const savedAccent = State.get().settings.accent;
  if (savedAccent) {
    document.documentElement.style.setProperty('--color-accent', savedAccent);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Utils.qsa('.modal:not([hidden])').forEach((m) => {
        Modal.close(m.id);
      });
      Sidebar.closeMobile();
    }
  });

  // Hide loader
  const loader = Utils.id('loader');
  setTimeout(() => loader.classList.add('loader--hidden'), 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
