/**
 * Content Scheduler App
 * Drag & drop content planning for the week
 */

// ===========================
// Constants & Configuration
// ===========================
const SLOTS_PER_DAY = 6;
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
    completionRateValue: document.getElementById('completionRateValue')
};

// ===========================
// Utility Functions
// ===========================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getDateKey(date) {
    return date.toISOString().split('T')[0];
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

    // Today + 6 days forward (7 days total)
    for (let i = 0; i <= 6; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }

    return dates;
}

function isToday(date) {
    const today = new Date();
    return getDateKey(date) === getDateKey(today);
}

// ===========================
// Data Management (API-First with LocalStorage Fallback)
// ===========================
const USE_API = window.location.protocol.includes('http'); // Only use API if running on server

async function loadData() {
    try {
        if (USE_API) {
            const response = await fetch('/api/data');
            if (response.ok) {
                const data = await response.json();
                appData = {
                    pool: data.pool || [],
                    schedule: data.schedule || {}
                };
                permanentNotes = data.notes || '';
            }
        } else {
            // Fallback to LocalStorage
            loadDataLocal();
        }
    } catch (e) {
        console.error('Error loading data from API, falling back to local:', e);
        loadDataLocal();
    }

    // Initial Render
    elements.permanentNotes.value = permanentNotes;
    render();
}

function loadDataLocal() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        appData = JSON.parse(stored);
    }
    const storedNotes = localStorage.getItem(NOTES_KEY);
    permanentNotes = storedNotes || '';
}

async function saveData() {
    // Save to LocalStorage always (as backup/instant)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));

    if (USE_API) {
        try {
            // Clean data before saving to ensure it's serializable if needed
            // (though JSON.stringify handles nulls in arrays fine)
            await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pool: appData.pool,
                    schedule: appData.schedule,
                    notes: permanentNotes
                })
            });
        } catch (e) {
            console.error('Error saving to API:', e);
        }
    }
}

async function saveNotes() {
    localStorage.setItem(NOTES_KEY, elements.permanentNotes.value);
    permanentNotes = elements.permanentNotes.value;
    showNotesSaved();

    if (USE_API) {
        saveData(); // Sync everything to JSON
    }
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
            const card = appData.schedule[dateKey].find(c => c && c.id === cardId);
            if (card) {
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

    // Remove from source (entire schedule to be safe and prevent duplicates)
    for (const dateKey in appData.schedule) {
        if (Array.isArray(appData.schedule[dateKey])) {
            appData.schedule[dateKey] = appData.schedule[dateKey].map(slot =>
                (slot && slot.id === card.id) ? null : slot
            );
        }
    }

    if (fromPool) {
        appData.pool = appData.pool.filter(c => c.id !== card.id);
    }

    // Initialize target day if needed
    if (!appData.schedule[targetKey]) {
        appData.schedule[targetKey] = Array(SLOTS_PER_DAY).fill(null);
    }

    // Set initial status as scheduled if coming from pool
    if (fromPool) {
        card.status = CARD_STATUS.SCHEDULED;
    }

    // Place card in target slot
    appData.schedule[targetKey][slotIndex] = card;

    saveData();
    render();
}

function handleDropToPool(e) {
    e.preventDefault();

    if (!draggedCard || draggedCard.fromPool) return;

    const { card, sourceDate } = draggedCard;

    // Remove from schedule (entirely to prevent duplicates)
    for (const dateKey in appData.schedule) {
        if (Array.isArray(appData.schedule[dateKey])) {
            appData.schedule[dateKey] = appData.schedule[dateKey].map(slot =>
                (slot && slot.id === card.id) ? null : slot
            );
        }
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
        el.querySelector('.card-description').addEventListener('input', (e) => {
            updateCardDescription(card.id, e.target.value, true);
        });

        elements.poolCards.appendChild(el);
    });

    // Make pool a drop target to return cards
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

        // Ensure schedule for this day is a fixed-size array
        if (!appData.schedule[dateKey]) {
            appData.schedule[dateKey] = Array(SLOTS_PER_DAY).fill(null);
        }

        const scheduleDay = appData.schedule[dateKey];
        const activeCardsCount = scheduleDay.filter(c => c !== null).length;
        const isComplete = activeCardsCount >= SLOTS_PER_DAY;

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

        // Render fixed slots (filled or empty)
        for (let i = 0; i < SLOTS_PER_DAY; i++) {
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
    const dates = getWeekDates();
    let contentCount = 0, reels = 0;

    dates.forEach(date => {
        const dateKey = getDateKey(date);
        const cards = appData.schedule[dateKey] || [];
        cards.forEach(card => {
            if (card) {
                if (card.type === 'post' || card.type === 'promo') contentCount++;
                else if (card.type === 'reel') reels++;
            }
        });
    });

    // Goals: Content (Posts + Promos) = 49/week, Reel = 7/week
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
    }
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
    let totalPosts = 0;
    let daysWithContent = 0;
    const today = new Date();

    // Calculate stats from schedule
    Object.keys(appData.schedule).forEach(dateKey => {
        const cards = appData.schedule[dateKey];
        if (cards && cards.length > 0) {
            totalPosts += cards.length;
            daysWithContent++;
        }
    });

    // Animate numbers
    elements.totalPostsValue.textContent = totalPosts;

    // Mock completion (based on days with at least 1 post vs days in month so far)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const rate = Math.round((daysWithContent / Math.max(1, today.getDate())) * 100);
    elements.completionRateValue.textContent = `${rate}%`;
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
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cards = appData.schedule[dateStr] || [];

        let dotsHTML = '';
        let postCount = 0;

        cards.forEach(c => {
            if (c) {
                if (c.type === 'post') { dotsHTML += '<div class="activity-dot post"></div>'; postCount++; }
                else if (c.type === 'reel') { dotsHTML += '<div class="activity-dot reel"></div>'; postCount++; }
                else if (c.type === 'promo') dotsHTML += '<div class="activity-dot post"></div>';
            }
        });

        // Goal met indicator (e.g., >= 3 posts)
        let isSuccess = cards.filter(c => c !== null).length >= 3;
        if (isSuccess) {
            dotsHTML = '<div class="activity-dot success"></div>' + dotsHTML;
        }

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

    // Mix Chart
    if (contentMixChart) contentMixChart.destroy();
    contentMixChart = new Chart(ctxMix, {
        type: 'doughnut',
        data: {
            labels: ['Posts', 'Promos', 'Reels'],
            datasets: [{
                data: [posts, promos, reels],
                backgroundColor: ['#6366f1', '#a855f7', '#ec4899'],
                borderWidth: 0,
                hoverOffset: 12,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '82%', // Thinner donut
            plugins: {
                legend: {
                    position: 'bottom', // Moved to bottom for better centering
                    labels: {
                        color: '#94a3b8',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 15, 20, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 12,
                    displayColors: false
                }
            },
            layout: {
                padding: {
                    top: 10,
                    bottom: 10
                }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;
                ctx.restore();

                // Calculate chart area center
                const chartArea = chart.chartArea;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                const fontSize = (height / 140).toFixed(2);
                ctx.font = `bold ${fontSize}em 'Inter', sans-serif`;
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillStyle = "#fff";

                const total = posts + promos + reels;
                ctx.fillText(total, centerX, centerY - 8);

                ctx.font = `500 ${(fontSize * 0.4).toFixed(2)}em 'Inter', sans-serif`;
                ctx.fillStyle = "#64748b";
                const subText = "TOTAL";
                ctx.fillText(subText, centerX, centerY + 18);
                ctx.save();
            }
        }]
    });

    // Trend Chart (Mock data for demo + real weekly)
    if (activityTrendChart) activityTrendChart.destroy();
    activityTrendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Activity',
                data: [12, 19, 15, posts + promos + reels], // Mock + Real
                borderColor: '#22c55e',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
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

    // Horizontal Scroll with Wheel for Week Grid
    elements.weekGrid.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            elements.weekGrid.scrollLeft += e.deltaY;
        }
    });
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
