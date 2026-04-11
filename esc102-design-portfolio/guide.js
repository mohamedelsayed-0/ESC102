/**
 * guide.js — Interactive guided tour for the Engineering Portfolio
 * Adapted from the original walkthrough logic to support a multi-page tour.
 */

const HOME_PAGE = 'index.html';
const AUTO_START_DELAY_MS = 1500;
const TOUR_VIEWPORT_MARGIN = 24;
const CARD_POSITION_DELAY_MS = 900;
const TOUR_STEP_KEY = 'portfolio_tour_step';
const TOUR_RETURN_HOME_KEY = 'portfolio_tour_return_home';

const PAGE_LABELS = {
    'index.html': 'Home',
    'position.html': 'Position',
    'projects.html': 'Projects',
    'ctmfs.html': 'Handbook',
    'references.html': 'References'
};

// ─── STEPS ───────────────────────────────────────────────────────────────────
const STEPS = [
    {
        page: 'index.html',
        title: 'Portfolio Guide',
        body: 'Use this guide to find the key sections quickly.',
        highlight: '.hero-band h1',
        highlightPad: { top: 10, right: 20, bottom: 10, left: 20 }
    },
    {
        page: 'index.html',
        title: 'Table Of Contents',
        body: 'This is the Table of Contents. Use it to navigate the portfolio.',
        highlight: '#table-of-contents',
        highlightPad: { top: 18, right: 18, bottom: 18, left: 18 },
        hintSelector: () => document.querySelector('#table-of-contents'),
        scrollTarget: () => document.querySelector('#table-of-contents'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'The Document Map',
        body: "This map provides quick access to the main sections.",
        highlight: '.document-map',
        highlightPad: { top: 20, right: 20, bottom: 20, left: 20 },
        scrollTarget: () => document.querySelector('.document-map'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'Project Map Cards',
        body: "The project map does the visual signposting: each card names the project, previews the concept trail, and jumps into the relevant case.",
        highlight: '.project-map-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.project-map-card:first-child'),
        scrollTarget: () => document.querySelector('.project-map-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'Navigation Across The Site',
        body: "The navigation stays fixed across every page.",
        highlight: '.site-nav',
        highlightPad: { top: 5, right: 10, bottom: 5, left: 10 },
        autoScroll: false,
        hintSelector: () => document.querySelector(".site-nav a[href='position.html']")
    },
    {
        page: 'position.html',
        title: 'Formal Position First',
        body: "The position block states what engineering design means to me now.",
        highlight: '.position-story',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.position-story'),
        scrollTarget: () => document.querySelector('.position-story'),
        scrollAlignment: 'start'
    },
    {
        page: 'projects.html',
        title: 'Jump Between Project Cases',
        body: "The jump buttons let you move directly to one project case.",
        highlight: '.hero-actions',
        highlightPad: { top: 12, right: 12, bottom: 12, left: 12 },
        hintSelector: () => document.querySelector('.hero-actions')
    },
    {
        page: 'projects.html',
        title: 'CTMF Lens For Each Case',
        body: "Each project includes a compact CTMF lens before the detailed discussion.",
        highlight: '#praxis-1 .project-ctmf-strip',
        highlightPad: { top: 14, right: 14, bottom: 14, left: 14 },
        hintSelector: () => document.querySelector('#praxis-1 .project-ctmf-strip'),
        scrollTarget: () => document.querySelector('#praxis-1 .project-ctmf-strip'),
        scrollAlignment: 'center'
    },
    {
        page: 'projects.html',
        title: 'Open Figures And Code',
        body: "Click any image figure or code artifact card to expand it.",
        highlight: '#praxis-1 .figure-card:first-of-type',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('#praxis-1 .figure-card:first-of-type'),
        scrollTarget: () => document.querySelector('#praxis-1 .figure-card:first-of-type'),
        scrollAlignment: 'start'
    },
    {
        page: 'projects.html',
        title: 'Open The Original Source Files',
        body: "Under each artifact, these links open the original PDF, drawing, report, or source code file.",
        highlight: '#praxis-1 .download-links',
        highlightPad: { top: 12, right: 12, bottom: 12, left: 12 },
        hintSelector: () => document.querySelector('#praxis-1 .download-links'),
        scrollTarget: () => document.querySelector('#praxis-1 .download-links'),
        scrollAlignment: 'center'
    },
    {
        page: 'projects.html',
        title: 'Trace Into The Handbook',
        body: "The CTMF lens links move from a project case into the related handbook entries.",
        highlight: '#praxis-1 .project-ctmf-pill:first-child',
        highlightPad: { top: 12, right: 12, bottom: 12, left: 12 },
        hintSelector: () => document.querySelector('#praxis-1 .project-ctmf-pill:first-child'),
        scrollTarget: () => document.querySelector('#praxis-1 .project-ctmf-pill:first-child'),
        scrollAlignment: 'center'
    },
    {
        page: 'ctmfs.html',
        title: 'Project-To-Concept Shortcuts',
        body: "This clickable concept map is a shortcut through the handbook. Each node jumps to the specific idea that changed the project work.",
        highlight: '.ctmf-map-row:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.ctmf-map-row:first-child'),
        scrollTarget: () => document.querySelector('.ctmf-map-row:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'ctmfs.html',
        title: 'What Every CTMF Entry Shows',
        body: "Each entry explains the concept, application, artifact links, what it revealed, and a short assessment.",
        highlight: '#ctmf-backpack-design-concepts',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('#ctmf-backpack-design-concepts'),
        scrollTarget: () => document.querySelector('#ctmf-backpack-design-concepts'),
        scrollAlignment: 'start'
    },
    {
        page: 'references.html',
        title: 'Reference List',
        body: "This page lists the cited artifacts in IEEE-style numbered format.",
        highlight: '.resource-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.resource-card:first-child'),
        scrollTarget: () => document.querySelector('.resource-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'references.html',
        title: 'Reference Links',
        body: 'These entries link directly to the cited PDFs, images, source files, and repositories.',
        highlight: '.ieee-list',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.ieee-list'),
        scrollTarget: () => document.querySelector('.ieee-list'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'Back At The Beginning',
        body: "That's it! Hope you enjoy going through this.",
        highlight: '.hero-band',
        highlightPad: { top: 18, right: 18, bottom: 18, left: 18 },
        hintSelector: () => document.querySelector('.hero-band'),
        scrollTarget: () => document.querySelector('.hero-band'),
        scrollAlignment: 'start',
        endAtHome: true,
        nextLabel: 'Explore'
    }
];

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentStep = 0;
let active = false;
let _card = null;
let _ring = null;
let _mask = null;
let _maskRaf = null;
let _entryInitialized = false;

// ─── PUBLIC API ──────────────────────────────────────────────────────────────
window.startPortfolioTour = function () {
    clearTourCompletion();
    clearTourState();

    if (getCurrentPage() !== HOME_PAGE) {
        setTourState(0);
        window.location.href = HOME_PAGE;
        return;
    }

    startTourAt(0);
};

// ─── CORE LOGIC ─────────────────────────────────────────────────────────────
function startTourAt(idx) {
    const step = STEPS[idx];
    if (!step) {
        return;
    }

    if (step.page !== getCurrentPage()) {
        setTourState(idx);
        window.location.href = step.page;
        return;
    }

    if (active) {
        cleanup();
    }

    document.body.classList.add('wt-active');
    active = true;
    currentStep = idx;
    setTourState(idx);

    buildShell();
    showStep(idx);
}

function buildShell() {
    _mask = document.createElement('div');
    _mask.className = 'wt-mask';
    document.body.appendChild(_mask);

    _ring = document.createElement('div');
    _ring.className = 'wt-ring';
    document.body.appendChild(_ring);

    _card = document.createElement('div');
    _card.className = 'wt-float-card';
    document.body.appendChild(_card);
}

function showStep(idx) {
    if (idx >= STEPS.length) {
        endTour({ returnHome: true });
        return;
    }

    const step = STEPS[idx];
    const target = getStepTarget(step);

    if (step.highlight && !target) {
        goToStep(idx + 1);
        return;
    }

    const scrollTarget = step.autoScroll === false ? null : getStepTarget(step);

    if (scrollTarget) {
        scrollTargetIntoFrame(scrollTarget, step);
    }

    const dots = STEPS.map((_, i) =>
        `<span class="wt-dot ${i === idx ? 'wt-dot-active' : ''}"></span>`
    ).join('');

    _card.innerHTML = `
        <div class="wt-header">
            <div class="wt-dots">${dots}</div>
            <div class="wt-nav-controls">
                <button class="wt-arrow-btn" id="wtBack" ${idx === 0 ? 'disabled' : ''}>&larr;</button>
                <span class="wt-count">${idx + 1} / ${STEPS.length}</span>
                <button class="wt-arrow-btn" id="wtNextSmall" ${idx === STEPS.length - 1 ? 'disabled' : ''}>&rarr;</button>
            </div>
        </div>
        <div class="wt-title">${step.title}</div>
        <div class="wt-body">${step.body}</div>
        <div class="wt-footer">
            <button class="wt-skip-btn" id="wtSkip">Skip tour</button>
            <button class="wt-next-btn" id="wtNext">${getPrimaryLabel(idx)}</button>
        </div>
    `;

    document.getElementById('wtNext').onclick = advance;
    if (idx > 0) {
        document.getElementById('wtBack').onclick = back;
    }
    if (idx < STEPS.length - 1) {
        document.getElementById('wtNextSmall').onclick = advance;
    }
    document.getElementById('wtSkip').onclick = () => endTour();

    positionRing(step.highlight, step.highlightPad);

    setTimeout(() => {
        if (active && currentStep === idx) {
            positionCard(step);
            _card.classList.add('wt-visible');
        }
    }, CARD_POSITION_DELAY_MS);
}

function advance() {
    const step = STEPS[currentStep];

    if (step?.endAtHome) {
        endTour({ returnHome: true });
        return;
    }

    goToStep(currentStep + 1);
}

function back() {
    if (currentStep > 0) {
        goToStep(currentStep - 1);
    }
}

function goToStep(idx) {
    const step = STEPS[idx];
    if (!step) {
        endTour({ returnHome: true });
        return;
    }

    setTourState(idx);

    if (step.page !== getCurrentPage()) {
        cleanup();
        window.location.href = step.page;
        return;
    }

    currentStep = idx;
    showStep(idx);
}

function getPrimaryLabel(idx) {
    const step = STEPS[idx];
    if (step?.nextLabel) {
        return step.nextLabel;
    }

    if (step?.endAtHome || idx === STEPS.length - 1) {
        return 'Done';
    }

    const nextStep = STEPS[idx + 1];
    if (nextStep && nextStep.page !== step.page) {
        return `Open ${PAGE_LABELS[nextStep.page]} &rarr;`;
    }

    return 'Continue &rarr;';
}

function positionRing(selector, pad) {
    cancelAnimationFrame(_maskRaf);
    if (!selector) {
        _ring.style.opacity = '0';
        _mask.style.clipPath = 'none';
        return;
    }

    const track = () => {
        if (!active) {
            return;
        }

        const el = document.querySelector(selector);
        if (!el) {
            return;
        }

        const rect = el.getBoundingClientRect();
        const p = pad || { top: 10, right: 10, bottom: 10, left: 10 };

        const top = rect.top - (p.top || 0);
        const left = rect.left - (p.left || 0);
        const width = rect.width + (p.left || 0) + (p.right || 0);
        const height = rect.height + (p.top || 0) + (p.bottom || 0);
        const right = left + width;
        const bottom = top + height;

        _ring.style.top = `${top}px`;
        _ring.style.left = `${left}px`;
        _ring.style.width = `${width}px`;
        _ring.style.height = `${height}px`;
        _ring.style.opacity = '1';

        _mask.style.clipPath = `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${left}px ${top}px,
            ${left}px ${bottom}px,
            ${right}px ${bottom}px,
            ${right}px ${top}px,
            ${left}px ${top}px
        )`;

        _maskRaf = requestAnimationFrame(track);
    };

    _maskRaf = requestAnimationFrame(track);
}

function getStepTarget(step) {
    if (step.scrollTarget) {
        return step.scrollTarget();
    }

    if (step.highlight) {
        return document.querySelector(step.highlight);
    }

    return null;
}

function getCurrentPage() {
    const currentFile = window.location.pathname.split('/').pop();
    return currentFile || HOME_PAGE;
}

function getNavigationType() {
    const navigationEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
    if (navigationEntry?.type) {
        return navigationEntry.type;
    }

    switch (window.performance?.navigation?.type) {
        case 1:
            return 'reload';
        case 2:
            return 'back_forward';
        default:
            return 'navigate';
    }
}

function hasInternalReferrer() {
    if (!document.referrer) {
        return false;
    }

    try {
        const referrer = new URL(document.referrer);
        return referrer.origin === window.location.origin;
    } catch (error) {
        return false;
    }
}

function getStickyHeaderOffset() {
    const header = document.querySelector('.site-header');
    if (!header) {
        return TOUR_VIEWPORT_MARGIN;
    }

    const rect = header.getBoundingClientRect();
    return Math.max(0, rect.bottom) + TOUR_VIEWPORT_MARGIN;
}

function scrollTargetIntoFrame(target, step) {
    const pad = step.highlightPad || {};
    const rect = target.getBoundingClientRect();
    const topInset = getStickyHeaderOffset() + (pad.top || 0);
    const bottomInset = TOUR_VIEWPORT_MARGIN + (pad.bottom || 0);
    const paddedTop = rect.top - (pad.top || 0);
    const paddedBottom = rect.bottom + (pad.bottom || 0);
    const paddedHeight = rect.height + (pad.top || 0) + (pad.bottom || 0);
    const availableHeight = window.innerHeight - topInset - bottomInset;
    let scrollTop = null;

    if (step.scrollAlignment === 'start' || paddedHeight > availableHeight) {
        scrollTop = window.scrollY + paddedTop - topInset;
    } else if (step.scrollAlignment === 'center' && paddedHeight <= availableHeight) {
        const centeredTop = topInset + ((availableHeight - paddedHeight) / 2);
        scrollTop = window.scrollY + paddedTop - centeredTop;
    } else if (paddedTop < topInset) {
        scrollTop = window.scrollY + paddedTop - topInset;
    } else if (paddedBottom > window.innerHeight - bottomInset) {
        scrollTop = window.scrollY + paddedBottom - (window.innerHeight - bottomInset);
    }

    if (scrollTop === null) {
        return;
    }

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({
        top: Math.max(0, Math.min(scrollTop, maxScroll)),
        behavior: 'smooth'
    });
}

function positionCard(step) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = _card.offsetWidth || 380;
    const ch = _card.offsetHeight || 300;
    const gap = 50;
    const edge = 20;
    const topBound = Math.max(20, getStickyHeaderOffset());
    const target = step.hintSelector ? step.hintSelector() : document.querySelector(step.highlight);
    const rect = target ? target.getBoundingClientRect() : {
        top: vh / 2,
        left: vw / 2,
        right: vw / 2,
        bottom: vh / 2
    };

    const clampX = (value) => Math.max(edge, Math.min(vw - cw - edge, value));
    const clampY = (value) => Math.max(topBound, Math.min(vh - ch - edge, value));
    const centeredX = clampX((vw - cw) / 2);
    const alignToTarget = clampX(rect.left + (rect.width - cw) / 2);
    const candidates = [
        { x: alignToTarget, y: clampY(rect.bottom + gap) },
        { x: alignToTarget, y: clampY(rect.top - gap - ch) },
        { x: clampX(rect.right + gap), y: clampY(rect.top + (rect.height - ch) / 2) },
        { x: clampX(rect.left - gap - cw), y: clampY(rect.top + (rect.height - ch) / 2) },
        { x: centeredX, y: clampY(vh - ch - edge) },
        { x: centeredX, y: topBound }
    ];
    const safePlacement = candidates.find((candidate) => !rectsOverlap(
        { left: candidate.x, top: candidate.y, right: candidate.x + cw, bottom: candidate.y + ch },
        expandRect(rect, gap * 0.55)
    ));
    const placement = safePlacement || candidates
        .map((candidate) => ({
            ...candidate,
            overlapArea: getOverlapArea(
                { left: candidate.x, top: candidate.y, right: candidate.x + cw, bottom: candidate.y + ch },
                rect
            )
        }))
        .sort((a, b) => a.overlapArea - b.overlapArea)[0];
    const x = placement.x;
    const y = placement.y;

    _card.style.left = `${x}px`;
    _card.style.top = `${y}px`;
}

function expandRect(rect, amount) {
    return {
        top: rect.top - amount,
        right: rect.right + amount,
        bottom: rect.bottom + amount,
        left: rect.left - amount
    };
}

function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getOverlapArea(a, b) {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
}

function endTour(options = {}) {
    const { returnHome = false } = options;

    clearTourState();
    cleanup();

    if (!returnHome) {
        return;
    }

    if (getCurrentPage() === HOME_PAGE) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    try {
        window.sessionStorage.setItem(TOUR_RETURN_HOME_KEY, '1');
    } catch (error) {
        // Ignore storage failures and still navigate home.
    }

    window.location.href = HOME_PAGE;
}

function shouldAutoStartTour() {
    if (isCaptureMode()) {
        return false;
    }

    if (getCurrentPage() !== HOME_PAGE) {
        return false;
    }

    const navigationType = getNavigationType();
    if (navigationType === 'reload') {
        return true;
    }

    if (navigationType === 'back_forward') {
        return false;
    }

    return !hasInternalReferrer();
}

function getTourState() {
    try {
        const raw = window.sessionStorage.getItem(TOUR_STEP_KEY);
        if (raw === null) {
            return null;
        }

        const idx = Number(raw);
        return Number.isInteger(idx) && idx >= 0 && idx < STEPS.length ? idx : null;
    } catch (error) {
        return null;
    }
}

function setTourState(idx) {
    try {
        window.sessionStorage.setItem(TOUR_STEP_KEY, String(idx));
    } catch (error) {
        // Ignore storage failures; the tour can still run on the current page.
    }
}

function clearTourState() {
    try {
        window.sessionStorage.removeItem(TOUR_STEP_KEY);
    } catch (error) {
        // Ignore storage failures.
    }
}

function handleTourCompletionReturn() {
    try {
        if (window.sessionStorage.getItem(TOUR_RETURN_HOME_KEY) !== '1') {
            return;
        }

        window.sessionStorage.removeItem(TOUR_RETURN_HOME_KEY);
        window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    } catch (error) {
        // Ignore storage failures.
    }
}

function clearTourCompletion() {
    try {
        window.sessionStorage.removeItem(TOUR_RETURN_HOME_KEY);
    } catch (error) {
        // Ignore storage failures.
    }
}

function cleanup() {
    active = false;
    cancelAnimationFrame(_maskRaf);
    document.body.classList.remove('wt-active');
    [_mask, _ring, _card].forEach((el) => el && el.remove());
    _mask = null;
    _ring = null;
    _card = null;
}

function initializeTourEntry() {
    if (_entryInitialized) {
        return;
    }

    if (isCaptureMode()) {
        return;
    }

    handleTourCompletionReturn();

    const pendingStep = getTourState();
    if (pendingStep !== null && STEPS[pendingStep]?.page === getCurrentPage()) {
        _entryInitialized = true;
        setTimeout(() => startTourAt(pendingStep), 350);
        return;
    }

    if (shouldAutoStartTour()) {
        _entryInitialized = true;
        setTimeout(() => startTourAt(0), AUTO_START_DELAY_MS);
    }
}

function isCaptureMode() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('capture') === '1';
    } catch (error) {
        return false;
    }
}

// Auto-start logic
window.addEventListener('load', initializeTourEntry);
window.addEventListener('pageshow', initializeTourEntry);
window.setTimeout(initializeTourEntry, 0);
