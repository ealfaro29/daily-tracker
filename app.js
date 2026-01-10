/**
 * Content Scheduler App
 * Drag & drop content planning for the week
 */

// ===========================
// Constants & Configuration
// ===========================
const SLOTS_PER_DAY = 8;
const STORAGE_KEY = 'contentSchedulerData';
const NOTES_KEY = 'contentSchedulerNotes';

// Content types
const CONTENT_TYPES = {
    POST: { id: 'post', label: 'Post', icon: '📷' },
    PROMO: { id: 'promo', label: 'Promo', icon: '📢' },
    REEL: { id: 'reel', label: 'Reel', icon: '🎬' }
};

// Card status in schedule
const CARD_STATUS = {
    SCHEDULED: 'scheduled',
    POSTED: 'posted'
};

// ===========================
// State
// ===========================
let appData = {
    pool: [],           // Cards in the pool
    schedule: {}        // Cards scheduled by date key
};
let permanentNotes = '';
let draggedCard = null;

// ===========================
// DOM Elements
// ===========================
const elements = {
    weekIndicator: document.getElementById('weekIndicator'),
    poolCards: document.getElementById('poolCards'),
    poolCount: document.getElementById('poolCount'),
    weekGrid: document.getElementById('weekGrid'),
    addPost: document.getElementById('addPost'),
    addPromo: document.getElementById('addPromo'),
    addReel: document.getElementById('addReel'),
    permanentNotes: document.getElementById('permanentNotes'),
    notesStatus: document.getElementById('notesStatus'),
    postsMetric: document.getElementById('postsMetric'),
    reelsMetric: document.getElementById('reelsMetric'),
    postsFill: document.getElementById('postsFill'),
    reelsFill: document.getElementById('reelsFill'),
    // Tabs & Dashboard
    tabBtns: document.querySelectorAll('.tab-btn'),
    views: document.querySelectorAll('.view-container'),
    monthCalendar: document.getElementById('monthCalendar'),
    currentMonthLabel: document.getElementById('currentMonthLabel'),
    prevMonthBtn: document.getElementById('prevMonth'),
    nextMonthBtn: document.getElementById('nextMonth'),
    totalPostsValue: document.getElementById('totalPostsValue'),
    completionRateValue: document.getElementById('completionRateValue'),
    // History
    historyGrid: document.getElementById('historyGrid'),
    historyWeekLabel: document.getElementById('historyWeekLabel'),
    histPrev: document.getElementById('histPrev'),
    histNext: document.getElementById('histNext'),
    // Context Menu
    cardContextMenu: document.getElementById('cardContextMenu'),
    menuDelete: document.getElementById('menuDelete'),
    menuEdit: document.getElementById('menuEdit')
};

// ===========================
// Utility Functions
// ===========================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateShort(date) {
    return date.getDate();
}

function getDayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
}

function getWeekDates() {
    const today = new Date();
    const dates = [];

    // Today + 3 days forward (4 days total)
    for (let i = 0; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }

    return dates;
}

function getCurrentWeekDates() {
    const now = new Date();
    const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
    const sundayDate = new Date(now);
    sundayDate.setDate(now.getDate() - currentDay);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(sundayDate);
        d.setDate(sundayDate.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
}

// ===========================
// Data Management (API-First with LocalStorage Fallback)
// ===========================
// ===========================
// Imports & Firebase Config
// ===========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD9Q9b_RkQ5KCUSoNdqs8W2C3jrB6Q_pCQ",
    authDomain: "daily-tracker-ee82c.firebaseapp.com",
    projectId: "daily-tracker-ee82c",
    storageBucket: "daily-tracker-ee82c.firebasestorage.app",
    messagingSenderId: "240727869932",
    appId: "1:240727869932:web:09e2f501e2674d65a698c9",
    measurementId: "G-X6CE1KMD4H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const DATA_DOC_ID = "global-tracker-data"; // Single document for ELI5 simplicity

// ===========================
// Data Management (Firebase Firestore)
// ===========================

async function loadData() {
    try {
        const docRef = doc(db, "daily-tracker-data", DATA_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // REMOTE DATA EXISTS -> Use it (Source of Truth)
            const data = docSnap.data();
            appData = data.appData || { pool: [], schedule: {} };
            permanentNotes = data.permanentNotes || '';
            console.log("Data loaded from Firebase");
        } else {
            // NO REMOTE DATA -> Check LocalStorage for Migration
            console.log("No Firebase data found. Checking local storage for migration...");
            const localData = localStorage.getItem(STORAGE_KEY);
            const localNotes = localStorage.getItem(NOTES_KEY);

            if (localData || localNotes) {
                // MIGRATE: Upload Local -> Firebase
                if (localData) appData = JSON.parse(localData);
                if (localNotes) permanentNotes = localNotes;

                await saveData(); // Save to Firebase immediately
                console.log("Migration successful: Local data uploaded to Firebase.");
            }
        }
    } catch (e) {
        console.error("Error loading/migrating data:", e);
        // Fallback to local if offline or error, just to show something
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) appData = JSON.parse(stored);
    }

    // Initial Render
    elements.permanentNotes.value = permanentNotes;
    render();
}

async function saveData() {
    // Save to Firestore
    try {
        await setDoc(doc(db, "daily-tracker-data", DATA_DOC_ID), {
            appData: appData,
            permanentNotes: permanentNotes,
            lastUpdated: new Date().toISOString()
        });
        // Keep LocalStorage as a backup/cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error("Error saving to Firebase:", e);
    }
}

async function saveNotes() {
    permanentNotes = elements.permanentNotes.value;
    // Debounce or just save directly (Firestore is fast enough for notes usually)
    await saveData();
    localStorage.setItem(NOTES_KEY, permanentNotes);
    showNotesSaved();
}

function showNotesSaved() {
    elements.notesStatus.classList.remove('saving');
}

function showNotesSaving() {
    elements.notesStatus.classList.add('saving');
}

// ===========================
// Card Creation
// ===========================
function createCard(type) {
    const card = {
        id: generateId(),
        type: type.id,
        description: '',
        createdAt: new Date().toISOString()
    };

    appData.pool.push(card);
    saveData();
    render();

    // Focus on the new card's input
    setTimeout(() => {
        const input = document.querySelector(`[data-id="${card.id}"] .card-description`);
        if (input) input.focus();
    }, 50);
}

function deleteCard(cardId, fromPool = true) {
    if (fromPool) {
        appData.pool = appData.pool.filter(c => c.id !== cardId);
    } else {
        // Remove from schedule - look through all days and all slots
        for (const dateKey in appData.schedule) {
            if (Array.isArray(appData.schedule[dateKey])) {
                appData.schedule[dateKey] = appData.schedule[dateKey].map(slot =>
                    (slot && slot.id === cardId) ? null : slot
                );
            }
        }
    }
    saveData();
    render();
}

function updateCardDescription(cardId, description, inPool = true) {
    if (inPool) {
        const card = appData.pool.find(c => c.id === cardId);
        if (card) card.description = description;
    } else {
        for (const dateKey in appData.schedule) {
            if (Array.isArray(appData.schedule[dateKey])) {
                const card = appData.schedule[dateKey].find(c => c && c.id === cardId);
                if (card) {
                    card.description = description;
                    break;
                }
            }
        }
    }
    saveData();
}

function toggleCardStatus(cardId) {
    for (const dateKey in appData.schedule) {
        if (Array.isArray(appData.schedule[dateKey])) {
            const cardIndex = appData.schedule[dateKey].findIndex(c => c && c.id === cardId);
            if (cardIndex !== -1) {
                const card = appData.schedule[dateKey][cardIndex];
                card.status = card.status === CARD_STATUS.POSTED
                    ? CARD_STATUS.SCHEDULED
                    : CARD_STATUS.POSTED;
                saveData();
                render();
                break;
            }
        }
    }
}

// ===========================
// Context Menu & Edit Logic
// ===========================
let activeContextCard = null;

function showContextMenu(e, cardId, isPool) {
    e.preventDefault();
    activeContextCard = { id: cardId, isPool };

    const menu = elements.cardContextMenu;
    menu.style.display = 'block';

    // Position menu properly, accounting for window boundaries
    const menuWidth = 180;
    const menuHeight = 100;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x -= menuWidth;
    if (y + menuHeight > window.innerHeight) y -= menuHeight;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Hide menu on click elsewhere
    const hideMenu = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', hideMenu);
    };
    setTimeout(() => document.addEventListener('click', hideMenu), 10);
}

function handleMenuDelete() {
    if (!activeContextCard) return;
    deleteCard(activeContextCard.id, activeContextCard.isPool);
    activeContextCard = null;
}

function handleMenuEdit() {
    if (!activeContextCard) return;

    const { id, isPool } = activeContextCard;

    // If it's a scheduled card, we can't edit text directly in the card face because it's a div
    // Let's use a prompt or transform it into a pool item temporarily? 
    // Actually, let's just use a prompt for simplicity as a premium "quick edit"
    const currentCard = isPool
        ? appData.pool.find(c => c.id === id)
        : Object.values(appData.schedule).flat().find(c => c && c.id === id);

    if (currentCard) {
        const newDesc = prompt("Edit content description:", currentCard.description || "");
        if (newDesc !== null) {
            updateCardDescription(id, newDesc, isPool);
            render();
        }
    }
    activeContextCard = null;
}

// ===========================
// Drag & Drop
// ===========================
function handleDragStart(e, card, fromPool = true) {
    draggedCard = { card, fromPool, sourceDate: null };

    if (!fromPool) {
        // Find which date this card is in
        for (const dateKey in appData.schedule) {
            if (appData.schedule[dateKey].find(c => c.id === card.id)) {
                draggedCard.sourceDate = dateKey;
                break;
            }
        }
    }

    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.day-column').forEach(col => {
        col.classList.remove('drag-over');
    });
    draggedCard = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const column = e.target.closest('.day-column');
    if (column) {
        column.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const column = e.target.closest('.day-column');
    if (column && !column.contains(e.relatedTarget)) {
        column.classList.remove('drag-over');
    }
}

function handleDrop(e, targetDate, slotIndex) {
    e.preventDefault();

    const column = e.target.closest('.day-column');
    if (column) column.classList.remove('drag-over');

    if (!draggedCard) return;

    const { card, fromPool, sourceDate } = draggedCard;
    const targetKey = getDateKey(targetDate);

    // Remove from source ONLY (to prevent losing card if dropped on same day)
    // We search the entire appData to ensure we remove any existing instance 
    // (prevention against "strange duplicates")
    appData.pool = appData.pool.filter(c => c.id !== card.id);
    for (const dKey in appData.schedule) {
        appData.schedule[dKey] = appData.schedule[dKey].map(slot =>
            (slot && slot.id === card.id) ? null : slot
        );
    }

    // Initialize target day if needed
    if (!appData.schedule[targetKey]) {
        appData.schedule[targetKey] = Array(SLOTS_PER_DAY).fill(null);
    }

    // Ensure slotIndex exists in array (allow expansion)
    while (slotIndex >= appData.schedule[targetKey].length) {
        appData.schedule[targetKey].push(null);
    }

    // Set initial status as scheduled if coming from pool
    if (fromPool) {
        card.status = CARD_STATUS.SCHEDULED;
    }

    // Place card in target slot
    appData.schedule[targetKey][slotIndex] = card;

    // Check if we need to add an extra empty slot at the end if the last one was filled
    if (appData.schedule[targetKey][appData.schedule[targetKey].length - 1] !== null) {
        appData.schedule[targetKey].push(null);
    }

    saveData();
    render();
}

function handleDropToPool(e) {
    e.preventDefault();

    if (!draggedCard || draggedCard.fromPool) return;

    const { card, sourceDate } = draggedCard;

    // Remove from source ONLY
    appData.pool = appData.pool.filter(c => c.id !== card.id);
    for (const dKey in appData.schedule) {
        appData.schedule[dKey] = appData.schedule[dKey].map(slot =>
            (slot && slot.id === card.id) ? null : slot
        );
    }

    // Add back to pool
    appData.pool.push(card);

    saveData();
    render();
}

// ===========================
// UI Rendering
// ===========================
function renderPool() {
    elements.poolCards.innerHTML = '';
    elements.poolCount.textContent = appData.pool.length;

    if (appData.pool.length === 0) {
        elements.poolCards.innerHTML = `
            <div class="empty-pool">
                <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 40px 20px;">
                    Create content cards and drag them to schedule
                </p>
            </div>
        `;
        return;
    }

    appData.pool.forEach(card => {
        const type = Object.values(CONTENT_TYPES).find(t => t.id === card.type);
        const el = document.createElement('div');
        el.className = `content-card ${card.type}`;
        el.dataset.id = card.id;
        el.draggable = true;

        el.innerHTML = `
            <button class="card-delete" data-action="delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <textarea class="card-description" placeholder="Add description..." rows="1">${card.description || ''}</textarea>
        `;

        // Drag events
        el.addEventListener('dragstart', (e) => handleDragStart(e, card, true));
        el.addEventListener('dragend', handleDragEnd);

        // Delete button
        el.querySelector('.card-delete').addEventListener('click', () => deleteCard(card.id, true));

        // Description update
        const textarea = el.querySelector('.card-description');
        textarea.addEventListener('input', (e) => {
            updateCardDescription(card.id, e.target.value, true);
        });

        // Save on Enter (prevent new line)
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.target.blur();
            }
        });

        // Context menu (Right-click)
        el.addEventListener('contextmenu', (e) => showContextMenu(e, card.id, true));

        elements.poolCards.appendChild(el);
    });

    // Container level drop
    elements.poolCards.addEventListener('dragover', handleDragOver);
    elements.poolCards.addEventListener('drop', handleDropToPool);
}

function renderWeekGrid() {
    const dates = getWeekDates();
    elements.weekGrid.innerHTML = '';

    // Update week indicator
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    elements.weekIndicator.textContent = `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;

    dates.forEach(date => {
        const dateKey = getDateKey(date);

        // Ensure schedule for this day exists
        if (!appData.schedule[dateKey]) {
            appData.schedule[dateKey] = Array(SLOTS_PER_DAY).fill(null);
        }

        const scheduleDay = appData.schedule[dateKey];
        const activeCardsCount = scheduleDay.filter(c => c !== null).length;
        const isComplete = activeCardsCount >= 5; // Goal is 5+

        const column = document.createElement('div');
        column.className = 'day-column';
        if (isToday(date)) {
            column.classList.add('today');
            if (activeCardsCount >= 5) {
                column.classList.add('goal-reached');
            }
        }

        column.innerHTML = `
            <div class="day-header">
                <div class="day-info">
                    <span class="day-name">${getDayName(date)}</span>
                    <span class="day-date">${formatDateShort(date)}</span>
                </div>
                <div class="day-progress ${isComplete ? 'complete' : ''}">
                    ${activeCardsCount}/${SLOTS_PER_DAY} ${isComplete ? '✓' : ''}
                </div>
            </div>
            <div class="day-slots"></div>
        `;

        const slotsContainer = column.querySelector('.day-slots');

        // Render all available slots
        for (let i = 0; i < scheduleDay.length; i++) {
            const card = scheduleDay[i];

            if (card) {
                // Render scheduled card
                const status = card.status || CARD_STATUS.SCHEDULED;
                const cardEl = document.createElement('div');
                cardEl.className = `scheduled-card ${card.type} ${status}`;
                cardEl.dataset.id = card.id;
                cardEl.draggable = true;

                const icon = card.type === 'post' ? '📷' : card.type === 'promo' ? '📢' : '🎬';

                // Super simple card: Icon + description on one line, no header
                cardEl.innerHTML = `
                    <div class="card-main">
                        <span class="card-icon">${icon}</span>
                        <div class="card-info">
                            <div class="card-desc">${card.description || 'New Entry'}</div>
                        </div>
                        <div class="card-check">
                            ${status === CARD_STATUS.POSTED ? '✓' : ''}
                        </div>
                    </div>
                `;

                cardEl.addEventListener('dragstart', (e) => handleDragStart(e, card, false));
                cardEl.addEventListener('dragend', handleDragEnd);
                cardEl.addEventListener('contextmenu', (e) => showContextMenu(e, card.id, false));
                cardEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleCardStatus(card.id);
                });

                slotsContainer.appendChild(cardEl);
            } else {
                // Render empty slot
                const slot = document.createElement('div');
                slot.className = 'empty-slot';
                slot.dataset.slotIndex = i;

                // Slot-specific drop events
                slot.addEventListener('dragover', handleDragOver);
                slot.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    slot.classList.add('drag-over-slot');
                });
                slot.addEventListener('dragleave', () => {
                    slot.classList.remove('drag-over-slot');
                });
                slot.addEventListener('drop', (e) => {
                    e.stopPropagation();
                    slot.classList.remove('drag-over-slot');
                    handleDrop(e, date, i);
                });

                slotsContainer.appendChild(slot);
            }
        }

        // Column level drop (if dropped outside specific slots, prepend or find first empty?)
        // For simplicity, we'll keep slot-level drops as primary, but column level defaults to first empty slot if possible
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
        column.addEventListener('drop', (e) => {
            // Find first empty slot if dropped on column
            if (e.target.classList.contains('day-column') || e.target.classList.contains('day-slots')) {
                const firstEmpty = scheduleDay.findIndex(s => s === null);
                if (firstEmpty !== -1) {
                    handleDrop(e, date, firstEmpty);
                }
            }
        });

        elements.weekGrid.appendChild(column);
    });
}

function renderMetrics() {
    const today = new Date();
    let contentCount = 0, reels = 0;

    // Calculate for a full week (7 days) regardless of display
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateKey = getDateKey(d);
        const cards = appData.schedule[dateKey] || [];
        cards.forEach(card => {
            if (card) {
                if (card.type === 'post' || card.type === 'promo') contentCount++;
                else if (card.type === 'reel') reels++;
            }
        });
    }

    // Goals: Content = 49 (7/day), Reels = 7 (1/day)
    const contentGoal = 49;
    const reelsGoal = 7;

    if (elements.postsMetric) {
        elements.postsMetric.textContent = `${contentCount}/${contentGoal}`;
        elements.postsFill.style.width = `${Math.min(100, (contentCount / contentGoal) * 100)}%`;
    }

    if (elements.reelsMetric) {
        elements.reelsMetric.textContent = `${reels}/${reelsGoal}`;
        elements.reelsFill.style.width = `${Math.min(100, (reels / reelsGoal) * 100)}%`;
    }
}

function render() {
    renderPool();
    renderWeekGrid();
    renderMetrics();

    // Also update dashboard if active
    if (currentView === 'metrics') {
        renderDashboard();
    }
}

// ===========================
// Tabs & Views
// ===========================
let currentView = 'scheduler';
let dashboardMonth = new Date();

function switchTab(viewId) {
    currentView = viewId;

    // Update Tab Buttons
    elements.tabBtns.forEach(btn => {
        if (btn.dataset.tab === viewId) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update Views
    elements.views.forEach(view => {
        if (view.id === `${viewId}-view`) view.classList.add('active');
        else view.classList.remove('active');
    });

    if (viewId === 'metrics') {
        renderDashboard();
    } else if (viewId === 'history') {
        renderHistory();
    }
}

function renderHistory() {
    const dates = getCurrentWeekDates(); // Returns 7 days (Sun-Sat)
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Update Header
    elements.historyWeekLabel.textContent = `${months[startDate.getMonth()]} ${startDate.getDate()} - ${months[endDate.getMonth()]} ${endDate.getDate()}`;

    // Clear Grid
    elements.historyGrid.innerHTML = '';
    elements.historyGrid.className = 'history-week-grid';

    // Logic: Render 7 columns, just like Scheduler but read-only and filtering for POSTED
    dates.forEach(date => {
        const dateKey = getDateKey(date);
        const dayCards = appData.schedule[dateKey] || []; // default to empty

        // Filter for PUBLISHED cards only
        const postedCards = dayCards.filter(c => c && c.status === CARD_STATUS.POSTED);

        // Create Column
        const column = document.createElement('div');
        column.className = 'day-column';
        // Optional: Highlight current day in history too?
        if (isToday(date)) column.classList.add('today');

        // Header
        column.innerHTML = `
            <div class="day-header">
                <div class="day-info">
                    <span class="day-name">${getDayName(date)}</span>
                    <span class="day-date">${formatDateShort(date)}</span>
                </div>
                <div class="day-progress complete">
                    ${postedCards.length} Published
                </div>
            </div>
            <div class="day-slots history-slots"></div>
        `;

        const slotsContainer = column.querySelector('.day-slots');

        // Render Cards
        if (postedCards.length > 0) {
            postedCards.forEach(card => {
                const type = Object.values(CONTENT_TYPES).find(t => t.id === card.type);
                const cardEl = document.createElement('div');
                // Reuse .content-card class for consistent styling
                cardEl.className = `content-card ${card.type}`;
                // Don't make draggable in history
                cardEl.draggable = false;

                cardEl.innerHTML = `
                    <div class="card-description" style="pointer-events: none; margin-top: 0;">${card.description || ''}</div>
                `;

                // Add margins since slots container might lack gaps compared to drag grid
                cardEl.style.marginBottom = '8px';
                slotsContainer.appendChild(cardEl);
            });
        } else {
            // Empty state for day
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-slot';
            emptyEl.style.border = 'none'; // Clean look
            // emptyEl.textContent = 'No posts';
            slotsContainer.appendChild(emptyEl);
        }

        elements.historyGrid.appendChild(column);
    });
}

// ===========================
// Dashboard & Analytics
// ===========================
let contentMixChart = null;
let activityTrendChart = null;

function renderDashboard() {
    renderCalendar();
    renderKPIs();
    renderCharts();
}

function renderKPIs() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let successfulDaysPassed = 0;
    let totalDaysPassed = 0;

    // Iterate day by day for accurate "days passed" check
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= totalDaysInMonth; day++) {
        // Construct date object for this specific day
        const dateToCheck = new Date(currentYear, currentMonth, day);
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Only count days that have fully passed (strictly less than today's date, ignoring time)
        // We set hours to 0 to compare dates purely
        dateToCheck.setHours(0, 0, 0, 0);
        const todayZero = new Date();
        todayZero.setHours(0, 0, 0, 0);

        // Check content for this day
        const dayCards = (appData.schedule[dateKey] || []).filter(c => c !== null);
        totalScheduledMonth += dayCards.length;

        if (dateToCheck < todayZero) {
            totalDaysPassed++;
            // Goal per day is 5
            if (dayCards.length >= 5) {
                successfulDaysPassed++;
            }
        }
    }

    elements.totalPostsValue.textContent = totalScheduledMonth;

    // Completion Rate Logic:
    // 1. "Perfect Streak": (Successful Passed Days / Total Passed Days) * 100
    // If no days have passed yet (start of month), we can say 100% or 0% depending on optimism. Let's say 100% to start fresh.
    let streakRate = 100;
    if (totalDaysPassed > 0) {
        streakRate = Math.round((successfulDaysPassed / totalDaysPassed) * 100);
    }

    // 2. Month Progress: (Successful Passed Days / Total Days in Month) * 100
    const monthProgress = Math.round((successfulDaysPassed / totalDaysInMonth) * 100);

    // Update UI
    elements.completionRateValue.innerHTML = `
        ${streakRate}%
        <div style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 400; margin-top: 4px;">
            ${monthProgress}% of month total
        </div>
    `;
}

function renderCalendar() {
    const year = dashboardMonth.getFullYear();
    const month = dashboardMonth.getMonth();

    // Update Header
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    elements.currentMonthLabel.textContent = `${monthNames[month]} ${year}`;

    elements.monthCalendar.innerHTML = '';

    // Day Headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        const d = document.createElement('div');
        d.className = 'cal-day-header';
        d.textContent = day;
        elements.monthCalendar.appendChild(d);
    });

    // Calendar Days
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        elements.monthCalendar.appendChild(empty);
    }

    // Days
    for (let i = 1; i <= lastDate; i++) {
        // Use local date format for key to match schedule state
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cards = appData.schedule[dateStr] || [];

        let dotsHTML = '';
        cards.forEach(c => {
            if (c) {
                if (c.type === 'post') { dotsHTML += '<div class="activity-dot post"></div>'; }
                else if (c.type === 'reel') { dotsHTML += '<div class="activity-dot reel"></div>'; }
                else if (c.type === 'promo') { dotsHTML += '<div class="activity-dot promo"></div>'; }
            }
        });

        // Goal met indicator (e.g., >= 5 items)
        let isSuccess = cards.filter(c => c !== null).length >= 5;

        const cell = document.createElement('div');
        cell.className = `cal-day ${isSuccess ? 'success' : ''}`;

        cell.innerHTML = `
            <div class="cal-date">${i}</div>
            <div class="cal-activity-dots">${dotsHTML}</div>
        `;

        elements.monthCalendar.appendChild(cell);
    }
}

function renderCharts() {
    const ctxMix = document.getElementById('contentMixChart');
    const ctxTrend = document.getElementById('activityTrendChart');

    if (!ctxMix || !ctxTrend) return;

    // Aggregate Data
    let posts = 0, promos = 0, reels = 0;
    Object.values(appData.schedule).forEach(cards => {
        if (Array.isArray(cards)) {
            cards.forEach(c => {
                if (c) {
                    if (c.type === 'post') posts++;
                    else if (c.type === 'promo') promos++;
                    else if (c.type === 'reel') reels++;
                }
            });
        }
    });

    // Mix Chart (Stacked Bar)
    if (contentMixChart) contentMixChart.destroy();
    contentMixChart = new Chart(ctxMix, {
        type: 'bar',
        data: {
            labels: ['Total Content'],
            datasets: [
                {
                    label: 'Posts',
                    data: [posts],
                    backgroundColor: '#6366f1',
                    borderRadius: 4
                },
                {
                    label: 'Promos',
                    data: [promos],
                    backgroundColor: '#a855f7',
                    borderRadius: 4
                },
                {
                    label: 'Reels',
                    data: [reels],
                    backgroundColor: '#ec4899',
                    borderRadius: 4
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#e2e8f0',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { display: false },
                    border: { display: false }
                },
                y: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { display: false },
                    border: { display: false }
                }
            }
        }
    });

    // Trend Chart (Line)
    if (activityTrendChart) activityTrendChart.destroy();

    // Calculate weekly volume for trend
    const weeklyVolume = [0, 0, 0, 0];
    Object.keys(appData.schedule).forEach(dateKey => {
        const d = new Date(dateKey + 'T12:00:00');
        const week = Math.floor((d.getDate() - 1) / 7);
        if (week >= 0 && week < 4) {
            weeklyVolume[week] += appData.schedule[dateKey].filter(c => c !== null).length;
        }
    });

    activityTrendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Volume',
                data: weeklyVolume,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#22c55e'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Legend moved to header
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                }
            }
        }
    });
}
// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    // Add card buttons
    elements.addPost.addEventListener('click', () => createCard(CONTENT_TYPES.POST));
    elements.addPromo.addEventListener('click', () => createCard(CONTENT_TYPES.PROMO));
    elements.addReel.addEventListener('click', () => createCard(CONTENT_TYPES.REEL));

    // Notes auto-save
    elements.permanentNotes.addEventListener('input', () => {
        showNotesSaving();
        clearTimeout(window.notesTimeout);
        window.notesTimeout = setTimeout(saveNotes, 1000);
    });

    // Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Calendar Nav
    elements.prevMonthBtn.addEventListener('click', () => {
        dashboardMonth.setMonth(dashboardMonth.getMonth() - 1);
        renderCalendar();
    });
    elements.nextMonthBtn.addEventListener('click', () => {
        dashboardMonth.setMonth(dashboardMonth.getMonth() + 1);
        renderCalendar();
    });

    // History Nav
    if (elements.histPrev) {
        elements.histPrev.addEventListener('click', () => {
            historyOffset--;
            renderHistory();
        });
    }
    if (elements.histNext) {
        elements.histNext.addEventListener('click', () => {
            historyOffset++;
            renderHistory();
        });
    }

    // Context Menu Actions
    elements.menuDelete.addEventListener('click', handleMenuDelete);
    elements.menuEdit.addEventListener('click', handleMenuEdit);

    // Export Data
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
}

function exportData() {
    const backup = {
        appData: appData,
        permanentNotes: permanentNotes,
        timestamp: new Date().toISOString()
    };

    // Create downloadable blob
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create temp link and click it
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", `daily_tracker_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
}

// ===========================
// Initialize
// ===========================
function init() {
    loadData();
    setupEventListeners();
    render();
}

document.addEventListener('DOMContentLoaded', init);
