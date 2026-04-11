document.addEventListener("DOMContentLoaded", () => {
    const isCaptureMode = (() => {
        try {
            return new URLSearchParams(window.location.search).get("capture") === "1";
        } catch (error) {
            return false;
        }
    })();

    const navToggle = document.querySelector("[data-nav-toggle]");
    const siteNav = document.querySelector("[data-nav]");

    if (navToggle && siteNav) {
        navToggle.addEventListener("click", () => {
            const isOpen = siteNav.classList.toggle("is-open");
            navToggle.setAttribute("aria-expanded", String(isOpen));
        });

        siteNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                siteNav.classList.remove("is-open");
                navToggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    const currentFile = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav] a").forEach((link) => {
        const href = link.getAttribute("href");
        if (href === currentFile) {
            link.classList.add("is-active");
        }
    });

    const footerYear = document.querySelector("[data-year]");
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    document.querySelectorAll("[data-card-link]").forEach((card) => {
        const destination = card.getAttribute("data-card-link");
        if (!destination) {
            return;
        }

        const openDestination = () => {
            window.location.href = destination;
        };

        card.addEventListener("click", (event) => {
            if (event.target.closest("a, button")) {
                return;
            }

            openDestination();
        });

        card.addEventListener("keydown", (event) => {
            if (event.target.closest("a, button")) {
                return;
            }

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDestination();
            }
        });
    });

    if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
            window.requestAnimationFrame(() => {
                setTimeout(() => {
                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                    target.classList.add("hash-focus");
                    window.setTimeout(() => target.classList.remove("hash-focus"), 1600);
                }, 80);
            });
        }
    }

    const expandableFigures = document.querySelectorAll("figure.figure-card, figure.artifact-card");
    if (expandableFigures.length) {
        const modal = document.createElement("div");
        modal.className = "figure-lightbox";
        modal.setAttribute("hidden", "");
        modal.innerHTML = `
            <div class="figure-lightbox__backdrop" data-lightbox-close></div>
            <div class="figure-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Expanded figure">
                <button class="figure-lightbox__close" type="button" aria-label="Close expanded figure" data-lightbox-close>
                    Close
                </button>
                <div class="figure-lightbox__content" data-lightbox-content></div>
            </div>
        `;
        document.body.appendChild(modal);

        const lightboxContent = modal.querySelector("[data-lightbox-content]");
        const lightboxCloseControls = modal.querySelectorAll("[data-lightbox-close]");
        let lastFocusedFigure = null;

        const closeLightbox = () => {
            modal.setAttribute("hidden", "");
            document.body.classList.remove("lightbox-open");
            lightboxContent.innerHTML = "";
            if (lastFocusedFigure) {
                lastFocusedFigure.focus();
            }
        };

        const openLightbox = (figure) => {
            const img = figure.querySelector("img");
            const codeSnippet = figure.querySelector("pre");
            const caption = figure.querySelector(".figure-caption");
            const annotation = figure.querySelector(".figure-annotation");

            lightboxContent.innerHTML = "";

            const shell = document.createElement("div");
            shell.className = "figure-lightbox__shell";

            if (img) {
                const clone = img.cloneNode(true);
                clone.classList.add("figure-lightbox__media");
                shell.appendChild(clone);
            } else if (codeSnippet) {
                const clone = codeSnippet.cloneNode(true);
                clone.classList.add("figure-lightbox__code");
                shell.appendChild(clone);
            }

            if (caption || annotation) {
                const meta = document.createElement("div");
                meta.className = "figure-lightbox__meta";

                if (caption) {
                    const captionNode = document.createElement("p");
                    captionNode.className = "figure-lightbox__caption";
                    captionNode.textContent = caption.textContent.trim();
                    meta.appendChild(captionNode);
                }

                if (annotation) {
                    const annotationNode = document.createElement("p");
                    annotationNode.className = "figure-lightbox__annotation";
                    annotationNode.textContent = annotation.textContent.trim();
                    meta.appendChild(annotationNode);
                }

                shell.appendChild(meta);
            }

            lightboxContent.appendChild(shell);
            modal.removeAttribute("hidden");
            document.body.classList.add("lightbox-open");
            modal.querySelector(".figure-lightbox__close").focus();
        };

        lightboxCloseControls.forEach((control) => {
            control.addEventListener("click", closeLightbox);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !modal.hasAttribute("hidden")) {
                closeLightbox();
            }
        });

        expandableFigures.forEach((figure) => {
            const body = figure.querySelector(".figure-body, .artifact-body");
            const expandNote = document.createElement("p");
            expandNote.className = "figure-expand-note";
            expandNote.textContent = "Click figure to expand.";

            if (body) {
                body.appendChild(expandNote);
            } else {
                figure.appendChild(expandNote);
            }

            figure.classList.add("is-expandable");
            figure.tabIndex = 0;
            figure.setAttribute("role", "button");
            figure.setAttribute("aria-label", "Expand figure");

            figure.addEventListener("click", (event) => {
                if (event.target.closest("a")) {
                    return;
                }

                lastFocusedFigure = figure;
                openLightbox(figure);
            });

            figure.addEventListener("keydown", (event) => {
                if (event.target.closest("a")) {
                    return;
                }

                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    lastFocusedFigure = figure;
                    openLightbox(figure);
                }
            });
        });
    }

    const revealItems = document.querySelectorAll(".reveal");
    if (revealItems.length) {
        if (isCaptureMode) {
            revealItems.forEach((item) => item.classList.add("is-visible"));
            return;
        }

        if (!("IntersectionObserver" in window)) {
            revealItems.forEach((item) => item.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.01,
                rootMargin: "0px 0px 120px 0px",
            },
        );

        revealItems.forEach((item) => observer.observe(item));
    }
});
