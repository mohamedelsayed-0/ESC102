/**
 * guide.js — Interactive guided tour for the Engineering Portfolio
 * Adapted from the 'Quantum Lab' logic to match the portfolio's premium theme.
 */

const AUTO_START_DELAY_MS = 1500;
const TOUR_VIEWPORT_MARGIN = 24;
const CARD_POSITION_DELAY_MS = 900;

// ─── STEPS ───────────────────────────────────────────────────────────────────
const STEPS = [
    {
        title: "The Design Argument",
        body: "Welcome to my ESC102 Design Portfolio! This site was made with the goal of being more than just a gallery, but rather it's a <strong>deliberately structured argument</strong>. From my position to the project evidence, every choice is traced through and justified.",
        highlight: ".hero-band h1",
        highlightPad: { top: 10, right: 20, bottom: 10, left: 20 },
        cardPlacement: "bottom-center"
    },
    {
        title: "Deliberate Structure",
        body: "The site order is <strong>intentional</strong>. We start with my 'Position Statement' to set the criteria, followed by 'Project Cases' to test them, and finally the 'CTMF Handbook' for evaluation.",
        highlight: ".hero-side-note",
        highlightPad: { top: 20, right: 20, bottom: 20, left: 20 },
        cardPlacement: "beside-hint",
        hintSelector: () => document.querySelector(".hero-side-note")
    },
    {
        title: "The Document Map",
        body: "This map shows how the portfolio is connected. My position frames the entire document, ensuring that every project is judged against explicit values like <strong>Clarity before Polish</strong>.",
        highlight: ".document-map",
        highlightPad: { top: 20, right: 20, bottom: 20, left: 20 },
        cardPlacement: "center",
        scrollTarget: () => document.querySelector(".document-map"),
        scrollAlignment: "start"
    },
    {
        title: "Visual Signposting",
        body: "One of my core design principles is <strong>Visual Signposting</strong>. Look for these 'Value Signals' and 'Evidence' tags throughout the site — they highlight the logic behind the prose.",
        highlight: ".quick-grid--supporting .link-card:first-child",
        highlightPad: { top: 15, right: 15, bottom: 15, left: 15 },
        cardPlacement: "beside-hint",
        hintSelector: () => document.querySelector(".quick-grid--supporting .link-card:first-child"),
        scrollTarget: () => document.querySelector(".quick-grid--supporting .link-card:first-child"),
        scrollAlignment: "start"
    },
    {
        title: "Interactive Components",
        body: "To go through, Use the <strong>Projects</strong> page to see the evidence of my process, or the <strong>Handbook</strong> to see how I evaluate design tools and frameworks.",
        highlight: ".site-nav",
        highlightPad: { top: 5, right: 10, bottom: 5, left: 10 },
        autoScroll: false,
        cardPlacement: "beside-hint",
        hintSelector: () => document.querySelector(".site-nav a[href='projects.html']")
    }
];

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentStep = 0;
let active = false;
let _card = null;
let _ring = null;
let _mask = null;
let _maskRaf = null;

// ─── PUBLIC API ──────────────────────────────────────────────────────────────
window.startPortfolioTour = function () {
    if (active) cleanup();

    document.body.classList.add('wt-active');
    active = true;
    currentStep = 0;

    buildShell();
    showStep(0);
};

// ─── CORE LOGIC ─────────────────────────────────────────────────────────────
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
    if (idx >= STEPS.length) { endTour(); return; }
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
            <button class="wt-next-btn" id="wtNext">
                ${idx === STEPS.length - 1 ? 'Start Exploring' : 'Continue &rarr;'}
            </button>
        </div>
    `;

    document.getElementById('wtNext').onclick = advance;
    if (idx > 0) document.getElementById('wtBack').onclick = back;
    if (idx < STEPS.length - 1) document.getElementById('wtNextSmall').onclick = advance;
    document.getElementById('wtSkip').onclick = endTour;

    positionRing(step.highlight, step.highlightPad);

    // Give browser plenty of time to finish smooth scrolling
    setTimeout(() => {
        if (active && currentStep === idx) {
            positionCard(idx, step);
            _card.classList.add('wt-visible');
        }
    }, CARD_POSITION_DELAY_MS);
}

function advance() {
    currentStep++;
    showStep(currentStep);
}

function back() {
    if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
    }
}

function positionRing(selector, pad) {
    cancelAnimationFrame(_maskRaf);
    if (!selector) {
        _ring.style.opacity = '0';
        _mask.style.clipPath = 'none';
        return;
    }

    const track = () => {
        if (!active) return;
        const el = document.querySelector(selector);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const p = pad || { top: 10, right: 10, bottom: 10, left: 10 };

        const top = rect.top - (p.top || 0);
        const left = rect.left - (p.left || 0);
        const width = rect.width + (p.left || 0) + (p.right || 0);
        const height = rect.height + (p.top || 0) + (p.bottom || 0);

        _ring.style.top = top + 'px';
        _ring.style.left = left + 'px';
        _ring.style.width = width + 'px';
        _ring.style.height = height + 'px';
        _ring.style.opacity = '1';

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const right = left + width;
        const bottom = top + height;

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

function positionCard(idx, step) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = _card.offsetWidth || 380;
    const ch = _card.offsetHeight || 300;
    const gap = 50;
    const topBound = Math.max(20, getStickyHeaderOffset());

    let x, y;

    const target = step.hintSelector ? step.hintSelector() : document.querySelector(step.highlight);
    const r = target ? target.getBoundingClientRect() : { top: vh/2, left: vw/2, width: 0, height: 0, right: vw/2, bottom: vh/2 };

    if (idx === 0) {
        x = (vw - cw) / 2;
        y = vh - ch - 40;
    } else {
        // Preferred: Below the element
        if (r.bottom + gap + ch < vh - 20) {
            x = (vw - cw) / 2;
            y = r.bottom + gap;
        } 
        // Secondary Preference: Above the element
        else if (r.top - gap - ch > 20) {
            x = (vw - cw) / 2;
            y = r.top - gap - ch;
        }
        // Fallback: Beside (Right)
        else if (r.right + gap + cw < vw - 20) {
            x = r.right + gap;
            y = Math.max(20, Math.min(vh - ch - 20, r.top));
        }
        // Fallback: Beside (Left)
        else if (r.left - gap - cw > 20) {
            x = r.left - gap - cw;
            y = Math.max(20, Math.min(vh - ch - 20, r.top));
        }
        // Final Desperation Focus: Pin to bottom
        else {
            x = (vw - cw) / 2;
            y = vh - ch - 20;
        }
    }

    // FINAL SAFETY CLAMP
    x = Math.max(20, Math.min(vw - cw - 20, x));
    y = Math.max(topBound, Math.min(vh - ch - 20, y));

    _card.style.left = x + 'px';
    _card.style.top = y + 'px';
}

function endTour() {
    cleanup();
}

function shouldAutoStartTour() {
    const navigationType = getNavigationType();
    if (navigationType === 'reload') {
        return true;
    }

    if (navigationType === 'back_forward') {
        return false;
    }

    return !hasInternalReferrer();
}

function cleanup() {
    active = false;
    cancelAnimationFrame(_maskRaf);
    document.body.classList.remove('wt-active');
    [_mask, _ring, _card].forEach(el => el && el.remove());
    _mask = _ring = _card = null;
}

// Auto-start logic
window.addEventListener('load', () => {
    if (shouldAutoStartTour()) {
        setTimeout(window.startPortfolioTour, AUTO_START_DELAY_MS);
    }
});
