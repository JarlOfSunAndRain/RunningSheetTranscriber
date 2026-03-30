/**
 * Review Page
 * Review, edit, filter, and include/exclude incident entries before export.
 * Mirrors the Transcribe layout but without the file column,
 * only showing rows that have content (time or comment filled in).
 */
const ReviewPage = (() => {
  let entries = [];
  let filteredEntries = [];
  let autosaveTimer = null;

  // Filter state
  let filters = {
    search: '',
    highlight: '',
    status: 'all',
  };

  // Sort state
  let sortField = 'time';
  let sortDir = 'asc';

  /**
   * Render the review page
   */
  async function render(container) {
    const sheet = App.getActiveSheet();
    if (!sheet) {
      container.innerHTML = `
        <div class="review-page">
          <div class="empty-state" style="height:100%">
            <p class="empty-state-title">No Running Sheet Open</p>
            <p class="empty-state-text">Open a running sheet from the Manager to review entries.</p>
          </div>
        </div>
      `;
      return;
    }

    entries = sheet.entries || [];
    applyFilters();
    renderPage(container);
  }

  /**
   * Apply filters and sorting — only rows with content
   */
  function applyFilters() {
    filteredEntries = entries.filter(entry => {
      // Always include break entries
      if (entry.type === 'break') return true;

      const hasContent = (entry.time && entry.time.trim() !== '') ||
        (entry.comment && entry.comment.trim() !== '');
      if (!hasContent) return false;

      // Status filter
      if (filters.status === 'included' && !entry.included) return false;
      if (filters.status === 'excluded' && entry.included) return false;

      // Highlight filter
      if (filters.highlight) {
        if (filters.highlight === 'none' && entry.highlight) return false;
        if (filters.highlight !== 'none' && entry.highlight !== filters.highlight) return false;
      }

      // Search filter
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchTime = (entry.time || '').toLowerCase().includes(q);
        const matchComment = (entry.comment || '').toLowerCase().includes(q);
        if (!matchTime && !matchComment) return false;
      }

      return true;
    });

    // No sort — preserve transcribe order
  }

  /**
   * Render the full page
   */
  function renderPage(container) {
    const contentEntries = entries.filter(e =>
      e.type !== 'break' && ((e.time && e.time.trim() !== '') || (e.comment && e.comment.trim() !== ''))
    );
    const totalWithContent = contentEntries.length;
    const includedCount = contentEntries.filter(e => e.included).length;
    const excludedCount = contentEntries.filter(e => !e.included).length;
    const filteredContentCount = filteredEntries.filter(e => e.type !== 'break').length;

    container.innerHTML = `
      <div class="transcribe-page">
        <div class="transcribe-header" style="flex-wrap: nowrap; gap: 12px;">
          <h2 style="white-space:nowrap; margin-right:12px;">Review</h2>

          <div class="review-filter-bar" style="flex:1; margin:0; padding:0; border:0; background:none;">
            <div class="filter-group">
              <div class="filter-search-wrapper">
                <svg class="filter-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="filter-search" id="filter-search"
                       placeholder="Search entries..." value="${filters.search}">
              </div>
            </div>

            <div class="filter-group">
              <label>Status</label>
              <select class="filter-select" id="filter-status">
                <option value="all" ${filters.status === 'all' ? 'selected' : ''}>All (${totalWithContent})</option>
                <option value="included" ${filters.status === 'included' ? 'selected' : ''}>Included (${includedCount})</option>
                <option value="excluded" ${filters.status === 'excluded' ? 'selected' : ''}>Excluded (${excludedCount})</option>
              </select>
            </div>

            <div class="filter-group">
              <label>Highlight</label>
              <select class="filter-select" id="filter-highlight">
                <option value="" ${filters.highlight === '' ? 'selected' : ''}>All</option>
                <option value="none" ${filters.highlight === 'none' ? 'selected' : ''}>None</option>
                <option value="incident" ${filters.highlight === 'incident' ? 'selected' : ''}>Incident of Interest</option>
                <option value="key" ${filters.highlight === 'key' ? 'selected' : ''}>Key Match Incident</option>
              </select>
            </div>

            <span class="filter-count">Showing ${filteredContentCount} of ${totalWithContent}</span>
          </div>

          <div class="transcribe-actions">
            <button class="btn btn-ghost btn-sm" id="btn-include-all" title="Include All Visible">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11L12 14L22 4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H16"/>
              </svg>
              Include All
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-exclude-all" title="Exclude All Visible">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6L18 18" stroke-linecap="round"/>
              </svg>
              Exclude All
            </button>
          </div>
        </div>

        <div class="transcribe-table-wrapper" id="review-table-wrapper">
          ${renderReviewTable()}
        </div>
      </div>
    `;

    bindReviewEvents();
    initHighlightDropdowns();
    autoExpandAll();

    const rw = document.getElementById('review-table-wrapper');
    if (rw) rw.scrollTop = 0;
  }

  /**
   * Refresh just the table and filter counts without full page re-render
   */
  function refreshTable() {
    const wrapper = document.getElementById('review-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderReviewTable();
      bindTableEvents();
      initHighlightDropdowns();
      autoExpandAll();
    }
    // Update filter counts
    const contentEntries = entries.filter(e =>
      e.type !== 'break' && ((e.time && e.time.trim() !== '') || (e.comment && e.comment.trim() !== ''))
    );
    const totalWithContent = contentEntries.length;
    const includedCount = contentEntries.filter(e => e.included).length;
    const excludedCount = contentEntries.filter(e => !e.included).length;
    const filteredContentCount = filteredEntries.filter(e => e.type !== 'break').length;
    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      statusSelect.options[0].textContent = `All (${totalWithContent})`;
      statusSelect.options[1].textContent = `Included (${includedCount})`;
      statusSelect.options[2].textContent = `Excluded (${excludedCount})`;
    }
    const countSpan = document.querySelector('.filter-count');
    if (countSpan) countSpan.textContent = `Showing ${filteredContentCount} of ${totalWithContent}`;
  }

  /**
   * Render the review table
   */
  function renderReviewTable() {
    if (filteredEntries.length === 0) {
      return `
        <div class="transcribe-empty">
          <p>No entries with content to review.</p>
        </div>
      `;
    }

    const sortIcon = (field) => {
      if (sortField !== field) return '<span class="sort-indicator">⇅</span>';
      return `<span class="sort-indicator">${sortDir === 'asc' ? '↑' : '↓'}</span>`;
    };

    let rows = '';
    filteredEntries.forEach((entry) => {
      // Period break row
      if (entry.type === 'break') {
        rows += `
          <tr class="period-break-row">
            <td colspan="4" class="period-break-cell">
              <div class="period-break-label">⏸ ${entry.breakLabel || 'BREAK'}</div>
            </td>
          </tr>
        `;
        return;
      }

      rows += `
        <tr data-entry-id="${entry.id}" class="${!entry.included ? 'excluded' : ''}">
          <td class="col-include">
            <div class="include-toggle">
              <input type="checkbox" class="review-include-cb"
                     data-entry-id="${entry.id}"
                     ${entry.included ? 'checked' : ''}
                     title="${entry.included ? 'Included' : 'Excluded'}">
            </div>
          </td>
          <td class="col-time">
            <input type="text" class="entry-time-input"
                   data-entry-id="${entry.id}"
                   data-field="time"
                   value="${entry.time || ''}"
                   placeholder="MM"
                   tabindex="0">
          </td>
          <td class="col-comment">
            <div class="entry-comment-input" contenteditable="true"
                 data-entry-id="${entry.id}"
                 data-field="comment"
                 tabindex="0">${entry.comment || ''}</div>
          </td>
          <td class="col-highlight">
            <select class="entry-highlight-select"
                    data-entry-id="${entry.id}"
                    tabindex="0">
              <option value="">None</option>
              <option value="incident" style="color:#00B050; font-weight:600;" ${entry.highlight === 'incident' ? 'selected' : ''}>🟢 Incident of Interest</option>
              <option value="key" style="color:#2E75B6; font-weight:600;" ${entry.highlight === 'key' ? 'selected' : ''}>🔵 Key Match Incident</option>
            </select>
          </td>
        </tr>
      `;
    });

    return `
      <table class="entry-table">
        <thead>
          <tr>
            <th class="col-include" style="width:50px" data-sort="included">Inc ${sortIcon('included')}</th>
            <th class="col-time" data-sort="time">Time ${sortIcon('time')}</th>
            <th class="col-comment" data-sort="comment">Incident / Comment ${sortIcon('comment')}</th>
            <th class="col-highlight">Highlight</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  /**
   * Bind highlight dropdown change events and style rows
   */
  function initHighlightDropdowns() {
    document.querySelectorAll('#review-table-wrapper .entry-highlight-select').forEach(select => {
      applyHighlightColor(select);
      select.addEventListener('change', () => {
        const entry = entries.find(e => e.id === select.dataset.entryId);
        if (entry) {
          entry.highlight = select.value || '';
          applyHighlightColor(select);
          scheduleAutosave();
        }
      });
    });
  }

  function applyHighlightColor(select) {
    const row = select.closest('tr');
    if (!row) return;
    if (select.value === 'incident') {
      row.style.backgroundColor = 'rgba(0, 176, 80, 0.3)';
      select.style.color = '#00B050';
      select.style.fontWeight = '600';
    } else if (select.value === 'key') {
      row.style.backgroundColor = 'rgba(46, 117, 182, 0.3)';
      select.style.color = '#2E75B6';
      select.style.fontWeight = '600';
    } else {
      row.style.backgroundColor = '';
      select.style.color = '';
      select.style.fontWeight = '';
    }
  }

  /**
   * Bind review page events
   */
  function bindReviewEvents() {
    // Search filter
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      let searchTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          filters.search = searchInput.value;
          applyFilters();
          refreshTable();
        }, 200);
      });
    }

    // Status filter
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      filters.status = e.target.value;
      applyFilters();
      refreshTable();
    });

    // Highlight filter
    document.getElementById('filter-highlight')?.addEventListener('change', (e) => {
      filters.highlight = e.target.value;
      applyFilters();
      refreshTable();
    });

    bindTableEvents();

    // Include All / Exclude All
    document.getElementById('btn-include-all')?.addEventListener('click', () => {
      filteredEntries.forEach(e => e.included = true);
      scheduleAutosave();
      renderPage(document.getElementById('page-container'));
      App.showToast(`${filteredEntries.length} entries included`, 'success');
    });

    document.getElementById('btn-exclude-all')?.addEventListener('click', () => {
      filteredEntries.forEach(e => e.included = false);
      scheduleAutosave();
      renderPage(document.getElementById('page-container'));
      App.showToast(`${filteredEntries.length} entries excluded`, 'info');
    });
  }

  /**
   * Bind table-specific events
   */
  function bindTableEvents() {
    // Sort headers
    document.querySelectorAll('.entry-table thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (sortField === field) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDir = 'asc';
        }
        applyFilters();
        renderPage(document.getElementById('page-container'));
      });
    });

    // Include/Exclude checkboxes
    document.querySelectorAll('.review-include-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const entry = entries.find(e => e.id === cb.dataset.entryId);
        if (entry) {
          entry.included = cb.checked;
          scheduleAutosave();
          applyFilters();
          refreshTable();
        }
      });
    });

    // Inline editing — time and comment
    document.querySelectorAll('#review-table-wrapper .entry-time-input').forEach(input => {
      input.addEventListener('focus', () => {
        UndoRedo.snapshot(entries, 'time edit');
      });
      input.addEventListener('input', () => {
        const entry = entries.find(e => e.id === input.dataset.entryId);
        if (entry) {
          entry.time = input.value;
          scheduleAutosave();
        }
      });
      input.addEventListener('blur', () => {
        UndoRedo.commit(entries);
      });
    });

    document.querySelectorAll('#review-table-wrapper .entry-comment-input').forEach(div => {
      div.addEventListener('focus', () => {
        UndoRedo.snapshot(entries, 'comment edit');
      });
      div.addEventListener('input', () => {
        const entry = entries.find(e => e.id === div.dataset.entryId);
        if (entry) {
          entry.comment = div.innerHTML;
          scheduleAutosave();
        }
      });
      div.addEventListener('blur', () => {
        UndoRedo.commit(entries);
      });

      // Paste as plain text
      div.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });
    });
  }

  /**
   * Refresh just the table
   */
  function refreshTable() {
    const wrapper = document.getElementById('review-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderReviewTable();
      initHighlightDropdowns();
      autoExpandAll();
      bindTableEvents();
    }
    const countEl = document.querySelector('.filter-count');
    const totalWithContent = entries.filter(e =>
      (e.time && e.time.trim()) || (e.comment && e.comment.trim())
    ).length;
    if (countEl) countEl.textContent = `Showing ${filteredEntries.length} of ${totalWithContent}`;
  }

  function autoExpandTextarea(el) {
    el.style.height = '';
    el.style.overflow = 'visible';
  }

  function autoExpandAll() {
    document.querySelectorAll('#review-table-wrapper .entry-comment-input').forEach(autoExpandTextarea);
  }

  /**
   * Debounced autosave
   */
  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      await Storage.saveEntries(App.getActiveSheetId(), entries);
    }, 300);
  }

  /**
   * Flush pending saves immediately
   */
  async function flushSave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
      if (entries.length > 0 && App.getActiveSheetId()) {
        await Storage.saveEntries(App.getActiveSheetId(), entries);
      }
    }
  }

  return { render, flushSave };
})();
