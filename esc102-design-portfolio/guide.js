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
        title: 'The Design Argument',
        body: 'This serves as a guide for whoever is viewing this to learn about key features and understand the structure / placement of key aspects of the portfolio.',
        highlight: '.hero-band h1',
        highlightPad: { top: 10, right: 20, bottom: 10, left: 20 }
    },
    {
        page: 'index.html',
        title: 'Start With The Position Statement',
        body: 'This is the first key stop in the portfolio. The Position Statement explains the values, strengths, biases, and framing ideas that the rest of the projects and handbook entries should be read against.',
        highlight: '.contents-card:first-child',
        highlightPad: { top: 18, right: 18, bottom: 18, left: 18 },
        hintSelector: () => document.querySelector('.contents-card:first-child'),
        scrollTarget: () => document.querySelector('.contents-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'Deliberate Structure',
        body: "The order is intentional. The <strong>Position Statement</strong> sets the test, the <strong>Projects</strong> show that test under pressure, and the <strong>CTMF Handbook</strong> explains the concepts that changed decisions.",
        highlight: '.hero-side-note',
        highlightPad: { top: 20, right: 20, bottom: 20, left: 20 },
        hintSelector: () => document.querySelector('.hero-side-note')
    },
    {
        page: 'index.html',
        title: 'The Document Map',
        body: "This map shows how the portfolio is connected. My position frames the rest of the document, so every project and CTMF entry is judged against explicit values like <strong>Clarity before Polish</strong>.",
        highlight: '.document-map',
        highlightPad: { top: 20, right: 20, bottom: 20, left: 20 },
        scrollTarget: () => document.querySelector('.document-map'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'Visual Signposting',
        body: "These tags are part of the reading system. Labels like <strong>Value signal</strong>, <strong>Evidence</strong>, and <strong>Growth</strong> tell you why a section is there before you read the full prose.",
        highlight: '.quick-grid--supporting .link-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.quick-grid--supporting .link-card:first-child'),
        scrollTarget: () => document.querySelector('.quick-grid--supporting .link-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'index.html',
        title: 'Navigation Across The Site',
        body: "The navigation stays fixed across every page. The rest of this tour will use those same pages to show how the argument continues from the statement, into the project cases, then into the handbook and source trail.",
        highlight: '.site-nav',
        highlightPad: { top: 5, right: 10, bottom: 5, left: 10 },
        autoScroll: false,
        hintSelector: () => document.querySelector(".site-nav a[href='position.html']")
    },
    {
        page: 'position.html',
        title: 'Jump Straight To Supporting Notes',
        body: "These proof cards are clickable. Each one jumps to the exact project note and CTMF trail that supports the claim made on this page, so the position never floats free from the evidence.",
        highlight: '.position-proof-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.position-proof-card:first-child'),
        scrollTarget: () => document.querySelector('.position-proof-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'projects.html',
        title: 'Jump Between Project Cases',
        body: "The project page keeps the three cases in one repeated reading pattern, and these buttons let you jump straight to a case without losing the overall structure.",
        highlight: '.hero-actions',
        highlightPad: { top: 12, right: 12, bottom: 12, left: 12 },
        hintSelector: () => document.querySelector('.hero-actions')
    },
    {
        page: 'projects.html',
        title: 'Open Figures And Code',
        body: "Click any image figure or code artifact card to expand it. The lightbox works throughout the project page, so you can inspect screenshots, drawings, plots, and code without leaving the argument.",
        highlight: '#praxis-1 .figure-card:first-of-type',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('#praxis-1 .figure-card:first-of-type'),
        scrollTarget: () => document.querySelector('#praxis-1 .figure-card:first-of-type'),
        scrollAlignment: 'start'
    },
    {
        page: 'projects.html',
        title: 'Open The Original Source Files',
        body: "Under each artifact, these links open the original PDF, drawing, report, or source code file. That keeps the writing tied directly to the underlying evidence package.",
        highlight: '#praxis-1 .download-links',
        highlightPad: { top: 12, right: 12, bottom: 12, left: 12 },
        hintSelector: () => document.querySelector('#praxis-1 .download-links'),
        scrollTarget: () => document.querySelector('#praxis-1 .download-links'),
        scrollAlignment: 'center'
    },
    {
        page: 'projects.html',
        title: 'Trace Into The Handbook',
        body: "These CTMF links move from a project case into the exact handbook entries that explain the concepts behind the evidence. The site is built to keep that jump short.",
        highlight: '#praxis-1 .project-links a:first-child',
        highlightPad: { top: 12, right: 12, bottom: 12, left: 12 },
        hintSelector: () => document.querySelector('#praxis-1 .project-links a:first-child'),
        scrollTarget: () => document.querySelector('#praxis-1 .project-links a:first-child'),
        scrollAlignment: 'center'
    },
    {
        page: 'ctmfs.html',
        title: 'Project-To-Concept Shortcuts',
        body: "These cluster cards are shortcuts through the handbook. They group concepts by project, so you can move from a case to the specific ideas that actually changed the work.",
        highlight: '.ctmf-cluster-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.ctmf-cluster-card:first-child'),
        scrollTarget: () => document.querySelector('.ctmf-cluster-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'ctmfs.html',
        title: 'What Every CTMF Entry Shows',
        body: "Each entry follows the same logic: what the concept meant here, how it was applied, what evidence supports it, what it revealed, where it fell short, and what I would do next.",
        highlight: '#ctmf-backpack-design-concepts',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('#ctmf-backpack-design-concepts'),
        scrollTarget: () => document.querySelector('#ctmf-backpack-design-concepts'),
        scrollAlignment: 'start'
    },
    {
        page: 'references.html',
        title: 'The Source Trail',
        body: "This page is the audit trail for the portfolio. These resource cards collect the full evidence packages, so the interpretation on the other pages can always be checked against the underlying files.",
        highlight: '.resource-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.resource-card:first-child'),
        scrollTarget: () => document.querySelector('.resource-card:first-child'),
        scrollAlignment: 'start'
    },
    {
        page: 'references.html',
        title: 'How To Check Any Claim',
        body: 'This is the last part of the source trail. From here, the guide will take you back to the landing page so you can begin the portfolio from the start with the full structure in mind.',
        highlight: '.page-stack > .section-card:last-of-type .info-card:first-child',
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        hintSelector: () => document.querySelector('.page-stack > .section-card:last-of-type .info-card:first-child'),
        scrollTarget: () => document.querySelector('.page-stack > .section-card:last-of-type .info-card:first-child'),
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
    const topBound = Math.max(20, getStickyHeaderOffset());
    const target = step.hintSelector ? step.hintSelector() : document.querySelector(step.highlight);
    const rect = target ? target.getBoundingClientRect() : {
        top: vh / 2,
        left: vw / 2,
        right: vw / 2,
        bottom: vh / 2
    };

    let x;
    let y;

    if (currentStep === 0) {
        x = (vw - cw) / 2;
        y = vh - ch - 40;
    } else if (rect.bottom + gap + ch < vh - 20) {
        x = (vw - cw) / 2;
        y = rect.bottom + gap;
    } else if (rect.top - gap - ch > 20) {
        x = (vw - cw) / 2;
        y = rect.top - gap - ch;
    } else if (rect.right + gap + cw < vw - 20) {
        x = rect.right + gap;
        y = Math.max(20, Math.min(vh - ch - 20, rect.top));
    } else if (rect.left - gap - cw > 20) {
        x = rect.left - gap - cw;
        y = Math.max(20, Math.min(vh - ch - 20, rect.top));
    } else {
        x = (vw - cw) / 2;
        y = vh - ch - 20;
    }

    x = Math.max(20, Math.min(vw - cw - 20, x));
    y = Math.max(topBound, Math.min(vh - ch - 20, y));

    _card.style.left = `${x}px`;
    _card.style.top = `${y}px`;
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

// Auto-start logic
window.addEventListener('load', initializeTourEntry);
window.addEventListener('pageshow', initializeTourEntry);
window.setTimeout(initializeTourEntry, 0);
