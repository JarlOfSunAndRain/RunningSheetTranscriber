/**
 * UndoRedo Service
 * Snapshot-based undo/redo for entry data.
 * Takes a snapshot before each edit and restores on undo.
 * Ctrl+Z to undo, Ctrl+Y / Ctrl+Shift+Z to redo.
 */
const UndoRedo = (() => {
    const MAX_HISTORY = 30;
    let undoStack = [];
    let redoStack = [];
    let pendingSnapshot = null;

    /**
     * Initialize — bind keyboard shortcuts
     */
    function init() {
        document.addEventListener('keydown', (e) => {
            // Don't intercept undo/redo when focused inside a contenteditable
            // that has active text selection (let browser handle it for text typing)
            const active = document.activeElement;
            const isContentEditable = active && active.getAttribute('contenteditable') === 'true';

            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                // Only intercept if we have something to undo
                if (undoStack.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    undo();
                }
            } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
                if (redoStack.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    redo();
                }
            }
        });
    }

    /**
     * Take a snapshot of current entries state.
     * Call this BEFORE making changes (e.g. on focus or before a batch operation).
     */
    function snapshot(entries, description = 'edit') {
        pendingSnapshot = {
            description,
            data: JSON.parse(JSON.stringify(entries)),
        };
    }

    /**
     * Commit the pending snapshot to the undo stack.
     * Call this AFTER changes have been made.
     * Pass the NEW state of entries so redo knows what to restore.
     */
    function commit(entries, description) {
        if (!pendingSnapshot) return;

        const undoData = pendingSnapshot.data;
        const redoData = JSON.parse(JSON.stringify(entries));
        const desc = description || pendingSnapshot.description;

        // Don't commit if nothing actually changed
        if (JSON.stringify(undoData) === JSON.stringify(redoData)) {
            pendingSnapshot = null;
            return;
        }

        undoStack.push({
            description: desc,
            undoData,
            redoData,
        });

        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }

        // Clear redo stack on new action
        redoStack = [];
        pendingSnapshot = null;
    }

    /**
     * Undo — restore the previous state.
     * Returns the entries array to restore, or null if nothing to undo.
     */
    function undo() {
        if (undoStack.length === 0) return null;
        const cmd = undoStack.pop();
        redoStack.push(cmd);

        // Restore entries in the active page
        _restore(cmd.undoData);
        return cmd.undoData;
    }

    /**
     * Redo — re-apply the undone change.
     * Returns the entries array to restore, or null if nothing to redo.
     */
    function redo() {
        if (redoStack.length === 0) return null;
        const cmd = redoStack.pop();
        undoStack.push(cmd);

        _restore(cmd.redoData);
        return cmd.redoData;
    }

    /**
     * Internal: restore entries and re-render the active page
     */
    async function _restore(data) {
        const sheetId = App.getActiveSheetId();
        if (!sheetId) return;

        // Capture scroll position and focused field before re-render
        const tableWrapper = document.querySelector('.transcribe-table-wrapper') ||
                             document.getElementById('review-table-wrapper');
        const savedScroll = tableWrapper ? tableWrapper.scrollTop : 0;

        const activeEl = document.activeElement;
        const focusedEntryId = activeEl?.dataset?.entryId || null;
        const focusedField = activeEl?.dataset?.field || null;

        // Blur active element to prevent auto-focus interference
        if (activeEl) activeEl.blur();

        // Save restored data to disk
        await Storage.saveEntries(sheetId, data);
        await App.refreshActiveSheet();

        // Re-render whichever page is active
        const container = document.getElementById('page-container');
        const sheet = App.getActiveSheet();
        if (sheet) {
            const transcribeTab = document.querySelector('.nav-tab[data-page="transcribe"].active');
            const reviewTab = document.querySelector('.nav-tab[data-page="review"].active');
            if (transcribeTab) {
                await TranscribePage.render(container);
            } else if (reviewTab) {
                await ReviewPage.render(container);
            }
        }

        // Restore scroll position and focus after re-render settles
        setTimeout(() => {
            const newWrapper = document.querySelector('.transcribe-table-wrapper') ||
                               document.getElementById('review-table-wrapper');
            if (newWrapper) {
                newWrapper.scrollTop = savedScroll;
            }

            // Restore focus to the same field
            if (focusedEntryId && focusedField) {
                const selector = focusedField === 'time'
                    ? `.entry-time-input[data-entry-id="${focusedEntryId}"]`
                    : `.entry-comment-input[data-entry-id="${focusedEntryId}"]`;
                const el = document.querySelector(selector);
                if (el) {
                    el.focus({ preventScroll: true });
                    // Place cursor at end for contenteditable
                    if (el.getAttribute('contenteditable') === 'true') {
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }
        }, 50);
    }

    /**
     * Clear stacks (e.g. when switching sheets)
     */
    function clear() {
        undoStack = [];
        redoStack = [];
        pendingSnapshot = null;
    }

    function canUndo() { return undoStack.length > 0; }
    function canRedo() { return redoStack.length > 0; }

    return { init, snapshot, commit, undo, redo, clear, canUndo, canRedo };
})();
