// Apply the saved appearance before the stylesheet paints. Keep this setting
// separate from dispatch data so switching modes never changes the shift.
(() => {
    'use strict';
    const appearanceKey = 'charlotte-dispatch-appearance-v1';
    const root = document.documentElement;
    const validMode = mode => mode === 'light' || mode === 'night';

    function applyAppearance(mode) {
        root.dataset.theme = mode;
        root.style.colorScheme = mode === 'night' ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content', mode === 'night' ? '#101827' : '#f7f9fc'
        );
        for (const button of document.querySelectorAll('[data-theme-choice]')) {
            button.setAttribute('aria-pressed', String(button.dataset.themeChoice === mode));
        }
    }

    let initialMode = 'night';
    try {
        const saved = localStorage.getItem(appearanceKey);
        if (validMode(saved)) initialMode = saved;
    } catch {
        // Mode switching still works when browser storage is unavailable.
    }
    applyAppearance(initialMode);

    function initializeAppearanceControls() {
        for (const button of document.querySelectorAll('[data-theme-choice]')) {
            button.addEventListener('click', () => {
                const mode = button.dataset.themeChoice;
                if (!validMode(mode)) return;
                applyAppearance(mode);
                try { localStorage.setItem(appearanceKey, mode); } catch { /* Keep the current mode for this session. */ }
            });
        }
        applyAppearance(root.dataset.theme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAppearanceControls, { once: true });
    } else {
        initializeAppearanceControls();
    }

    window.addEventListener('storage', event => {
        if (event.key === appearanceKey && (validMode(event.newValue) || event.newValue === null)) {
            applyAppearance(event.newValue || 'night');
        }
    });
})();
