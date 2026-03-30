/**
 * Export Page
 * Preview and export entries as Excel or PDF.
 */
const ExportPage = (() => {
  let entries = [];
  let metadata = {};
  let selectedFormat = 'pdf';

  /**
   * Render the export page
   */
  async function render(container) {
    const sheet = App.getActiveSheet();
    if (!sheet) {
      container.innerHTML = `
        <div class="export-page">
          <div class="empty-state" style="height:100%">
            <p class="empty-state-title">No Running Sheet Open</p>
            <p class="empty-state-text">Open a running sheet from the Manager to export.</p>
          </div>
        </div>
      `;
      return;
    }

    metadata = sheet.metadata || {};
    // Only included entries with content OR break entries, in transcribe order
    entries = (sheet.entries || [])
      .filter(e => e.type === 'break' || (e.included && ((e.time && e.time.trim()) || (e.comment && e.comment.trim()))));

    const retentionDays = await Storage.getRetentionDays();
    renderPage(container, metadata.completedAt || null, retentionDays);
  }

  /**
   * Build the match title
   */
  function getMatchTitle() {
    if (metadata.homeTeam && metadata.awayTeam) {
      return `${metadata.homeTeam}  vs  ${metadata.awayTeam}`;
    }
    return metadata.homeTeam || metadata.awayTeam || 'Untitled Match';
  }

  /**
   * Render the full page
   */
  function renderPage(container, completedAt = null, retentionDays = 30) {
    const isComplete = !!completedAt;
    let completeBtnLabel, completeBtnTitle, completeBtnClass;
    if (isComplete) {
      const deleteDate = new Date(new Date(completedAt).getTime() + retentionDays * 86400000);
      const deleteDateStr = deleteDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
      completeBtnLabel = `✓ Complete · Deletes ${deleteDateStr}`;
      completeBtnTitle = 'Remove Complete Status';
      completeBtnClass = 'btn-complete-toggle is-complete';
    } else {
      completeBtnLabel = 'Mark as Complete';
      completeBtnTitle = 'Mark this sheet as complete and queue for auto-deletion';
      completeBtnClass = 'btn-complete-toggle';
    }

    container.innerHTML = `
      <div class="export-page">
        <div class="export-header">
          <h2>Publish</h2>
          <div class="export-actions">
            <button class="btn btn-ghost btn-sm ${completeBtnClass}" id="btn-complete-sheet" data-complete="${isComplete}" title="${completeBtnTitle}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${completeBtnLabel}
            </button>
            <button class="btn btn-primary" id="btn-export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Publish PDF
            </button>
          </div>
        </div>

        <div class="export-options">
          <span class="export-summary">
            <strong>${entries.filter(e => e.type !== 'break').length}</strong> included entries will be published
          </span>
        </div>

        <div class="export-preview-wrapper">
          <div class="export-preview">
            ${renderPreview()}
          </div>
        </div>
      </div>
    `;

    bindExportEvents();
    // Paginate after DOM render so we can measure element heights
    requestAnimationFrame(() => paginatePreview());
  }

  /**
   * Render the document preview
   */
  function renderPreview() {
    const matchDate = metadata.matchDate
      ? new Date(metadata.matchDate + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    // Build compact officials line
    const officials = [];
    if (metadata.referee) officials.push(`Ref: ${metadata.referee}`);
    if (metadata.ar1) officials.push(`AR1: ${metadata.ar1}`);
    if (metadata.ar2) officials.push(`AR2: ${metadata.ar2}`);
    if (metadata.fourthOfficial) officials.push(`4th: ${metadata.fourthOfficial}`);
    if (metadata.var) officials.push(`VAR: ${metadata.var}`);
    if (metadata.avar) officials.push(`AVAR: ${metadata.avar}`);
    if (metadata.reserveAr) officials.push(`RAR: ${metadata.reserveAr}`);

    // Compact header
    let headerHtml = `
      <div class="preview-header-compact">
        <div class="preview-match-title">${getMatchTitle()}</div>
        <div class="preview-meta-row-compact">
          ${metadata.competition ? `<span>${metadata.competition}</span>` : ''}
          ${matchDate ? `<span>${matchDate}</span>` : ''}
          ${metadata.venue ? `<span>${metadata.venue}</span>` : ''}
        </div>
        ${officials.length > 0 ? `<div class="preview-officials">${officials.join(' &nbsp;|&nbsp; ')}</div>` : ''}
      </div>
    `;

    // Entries
    if (entries.length === 0) {
      return `<div class="preview-page">${headerHtml}<div class="preview-empty">No included entries to export.</div></div>`;
    }

    let rowsHtml = '';
    entries.forEach(entry => {
      // Period break row
      if (entry.type === 'break') {
        rowsHtml += `
          <tr class="preview-break-row">
            <td colspan="2" class="preview-break-cell">${entry.breakLabel || 'BREAK'}</td>
          </tr>
        `;
        return;
      }

      let rowStyle = '';
      if (entry.highlight === 'incident') rowStyle = 'background-color: #839F4E; color: #000000;';
      else if (entry.highlight === 'key') rowStyle = 'background-color: #5E96DE; color: #000000;';

      // Comment is now HTML (with <mark> tags for text highlights)
      const commentHtml = entry.comment || '';

      rowsHtml += `
        <tr style="${rowStyle}">
          <td class="col-time">${entry.time || ''}</td>
          <td class="col-comment">${commentHtml}</td>
        </tr>
      `;
    });

    const tableHtml = `
      <table class="preview-table">
        <thead>
          <tr>
            <th class="col-time">Time</th>
            <th class="col-comment">Incident / Comment</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // Render all content in a single hidden measuring page first
    // Pagination will be applied after DOM render in paginatePreview()
    return `<div class="preview-page" id="preview-page-measure">${headerHtml}${tableHtml}</div>`;
  }

  /**
   * Split rendered preview content into paginated A4 pages
   */
  function paginatePreview() {
    const PAGE_HEIGHT = 1060; // page height in px (matching CSS)
    const PAGE_PADDING = 136; // top + bottom padding (68 + 68)
    const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING;

    const measurePage = document.getElementById('preview-page-measure');
    if (!measurePage) return;

    const previewContainer = measurePage.parentElement;
    const children = Array.from(measurePage.children);

    // Collect all elements to paginate (header + table rows)
    const elements = [];
    children.forEach(child => {
      if (child.tagName === 'TABLE') {
        // Add thead as a unit
        const thead = child.querySelector('thead');
        if (thead) elements.push({ el: thead, type: 'thead', html: thead.outerHTML });
        // Add each row individually
        const rows = child.querySelectorAll('tbody tr');
        rows.forEach(row => elements.push({ el: row, type: 'row', html: row.outerHTML }));
      } else {
        elements.push({ el: child, type: 'header', html: child.outerHTML });
      }
    });

    // Build pages by measuring heights
    const pages = [];
    let currentPageHtml = '';
    let currentHeight = 0;
    let inTable = false;
    let theadHtml = '';

    elements.forEach((item) => {
      const itemHeight = item.el.getBoundingClientRect().height;

      if (item.type === 'thead') {
        theadHtml = item.html;
        // Start table
        currentPageHtml += `<table class="preview-table"><thead>${theadHtml}</thead><tbody>`;
        currentHeight += itemHeight;
        inTable = true;
        return;
      }

      // Check if item fits on current page
      if (currentHeight + itemHeight > CONTENT_HEIGHT && currentHeight > 0) {
        // Close current table if open
        if (inTable) currentPageHtml += '</tbody></table>';
        pages.push(currentPageHtml);
        // Start new page — re-add table header for continuation
        currentPageHtml = `<table class="preview-table"><thead>${theadHtml}</thead><tbody>`;
        currentHeight = elements.find(e => e.type === 'thead')?.el.getBoundingClientRect().height || 22;
        inTable = true;
      }

      if (item.type === 'header') {
        currentPageHtml += item.html;
      } else {
        currentPageHtml += item.html;
      }
      currentHeight += itemHeight;
    });

    // Close final table and page
    if (inTable) currentPageHtml += '</tbody></table>';
    pages.push(currentPageHtml);

    // Render paginated output
    let paginatedHtml = '';
    pages.forEach((pageContent, i) => {
      if (i > 0) {
        paginatedHtml += `<div class="preview-page-divider">Page ${i + 1}</div>`;
      }
      paginatedHtml += `<div class="preview-page">${pageContent}</div>`;
    });

    previewContainer.innerHTML = paginatedHtml;
  }

  /**
   * Bind export events
   */
  function bindExportEvents() {

    // Mark Complete / Remove Complete
    document.getElementById('btn-complete-sheet')?.addEventListener('click', async () => {
      const sheetId = App.getActiveSheetId();
      const sheet = App.getActiveSheet();
      if (!sheetId || !sheet) return;

      const isComplete = sheet.metadata.completedAt;
      const label = sheet.metadata.homeTeam && sheet.metadata.awayTeam
        ? `${sheet.metadata.homeTeam} vs ${sheet.metadata.awayTeam}`
        : 'Untitled Match';

      if (isComplete) {
        Modal.confirm({
          title: 'Remove Complete Status',
          message: `Remove the complete status from <strong>${label}</strong>? The sheet will return to active and will no longer be queued for deletion.`,
          confirmLabel: 'Remove Complete',
          confirmClass: 'btn-secondary',
          onConfirm: async () => {
            await Storage.removeComplete(sheetId);
            await App.refreshActiveSheet();
            App.showToast('Complete status removed', 'info');
            const container = document.getElementById('page-container');
            await ExportPage.render(container);
          },
        });
      } else {
        const retentionDays = await Storage.getRetentionDays();
        const deleteDate = new Date(Date.now() + retentionDays * 86400000);
        const deleteDateStr = deleteDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
        Modal.confirm({
          title: 'Mark as Complete',
          message: `Mark <strong>${label}</strong> as complete? It will be queued for automatic deletion after <strong>${retentionDays} days</strong> (on ${deleteDateStr}). The sheet will remain accessible until then.`,
          confirmLabel: 'Mark Complete',
          confirmClass: 'btn-primary',
          onConfirm: async () => {
            await Storage.markComplete(sheetId);
            await App.refreshActiveSheet();
            App.showToast('Sheet marked as complete', 'success');
            const container = document.getElementById('page-container');
            await ExportPage.render(container);
          },
        });
      }
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', async () => {
      if (entries.length === 0) {
        App.showToast('No entries to export', 'error');
        return;
      }

      const defaultName = getMatchTitle().replace(/[^a-zA-Z0-9\s-]/g, '') + '.pdf';

      const filePath = await window.api.dialog.saveFile({
        title: 'Export as PDF',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (!filePath) return;

      App.showToast('Exporting...', 'info');

      const exportData = {
        filePath,
        metadata,
        entries: entries.map(e => {
          // Pass break entries through
          if (e.type === 'break') {
            return { type: 'break', breakLabel: e.breakLabel || 'BREAK' };
          }

          // Strip HTML to plain text for PDF
          const div = document.createElement('div');
          div.innerHTML = e.comment || '';
          // Collect text highlight info for export
          const textHighlights = [];
          div.querySelectorAll('mark.text-mark').forEach(m => {
            textHighlights.push({
              text: m.textContent,
              color: m.style.backgroundColor,
            });
          });
          return {
            time: e.time || '',
            comment: div.textContent || '',
            highlight: e.highlight || '',
            textHighlights,
          };
        }),
      };

      const result = await window.api.export.toPdf(exportData);

      if (result.success) {
        App.showToast('Exported to PDF successfully!', 'success');
      } else {
        App.showToast(`Export failed: ${result.error}`, 'error');
      }
    });
  }

  return { render };
})();
