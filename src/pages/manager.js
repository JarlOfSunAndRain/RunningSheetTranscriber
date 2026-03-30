/**
 * Running Sheet Manager Page
 * Startup screen for managing running sheet projects.
 */
const ManagerPage = (() => {
  let currentSheets = [];
  let selectedSheetId = null;
  let searchFilter = '';

  /**
   * Render the manager page
   */
  async function render(container) {
    const rootDir = Storage.getRootDir();

    if (!rootDir) {
      renderSetupPrompt(container);
      return;
    }

    // Ensure directory exists
    await window.api.fs.mkdir(rootDir);

    // Auto-purge expired completed sheets
    await Storage.purgeExpiredSheets();

    currentSheets = await Storage.listRunningSheets();
    renderMainView(container);
  }

  /**
   * First-run: prompt user to select storage directory
   */
  function renderSetupPrompt(container) {
    container.innerHTML = `
      <div class="manager-page">
        <div class="setup-prompt">
          <svg class="setup-prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z"/>
          </svg>
          <h2>Welcome to Running Sheet Transcriber</h2>
          <p>To get started, select a folder where your running sheet projects will be stored. All match data will be saved here.</p>
          <button class="btn btn-primary btn-lg" id="setup-select-dir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z"/>
              <line x1="12" y1="11" x2="12" y2="17" stroke-linecap="round"/>
              <line x1="9" y1="14" x2="15" y2="14" stroke-linecap="round"/>
            </svg>
            Select Storage Folder
          </button>
        </div>
      </div>
    `;

    document.getElementById('setup-select-dir').addEventListener('click', async () => {
      const dir = await window.api.dialog.selectDirectory('Select Storage Folder for Running Sheets');
      if (dir) {
        await Storage.setRootDir(dir);
        App.showToast('Storage folder set successfully', 'success');
        render(container);
      }
    });
  }

  /**
   * Render main manager view
   */
  async function renderMainView(container) {
    const retentionDays = await Storage.getRetentionDays();

    container.innerHTML = `
      <div class="manager-page">
        <div class="manager-header">
          <h1>Browse</h1>
          <div class="manager-actions">
            <div class="search-wrapper">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" class="input search-input" id="sheet-search" placeholder="Search sheets...">
            </div>
            <button class="btn btn-primary" id="btn-create-sheet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" stroke-linecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/>
              </svg>
              Create Running Sheet
            </button>
          </div>
        </div>



        <div class="sheet-list-wrapper">
          ${renderSheetTable(retentionDays)}
        </div>
      </div>
    `;

    bindEvents(container, retentionDays);
  }

  /**
   * Render the sheet list table
   */
  function renderSheetTable(retentionDays = 30) {
    if (currentSheets.length === 0) {
      return `
        <div class="table-wrapper">
          <div class="empty-state" style="padding: 60px 20px;">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="7" y1="8" x2="17" y2="8" stroke-linecap="round"/>
              <line x1="7" y1="12" x2="17" y2="12" stroke-linecap="round"/>
              <line x1="7" y1="16" x2="13" y2="16" stroke-linecap="round"/>
            </svg>
            <p class="empty-state-title">No running sheets yet</p>
            <p class="empty-state-text">Create your first running sheet to start transcribing match incidents.</p>
          </div>
        </div>
      `;
    }

    // Filter sheets based on search
    let filteredSheets = currentSheets;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      filteredSheets = currentSheets.filter(sheet => {
        const fields = [
          sheet.homeTeam, sheet.awayTeam, sheet.matchDate,
          sheet.competition, sheet.venue, sheet.referee,
          sheet.fourthOfficial, sheet.ar1, sheet.ar2,
          sheet.var, sheet.avar, sheet.reserveAr,
        ];
        return fields.some(f => f && f.toLowerCase().includes(q));
      });
    }

    let rows = '';
    filteredSheets.forEach((sheet) => {
      const homeTeam = sheet.homeTeam || '';
      const awayTeam = sheet.awayTeam || '';
      const matchLabel = (homeTeam && awayTeam) ? `${homeTeam} vs ${awayTeam}` : (homeTeam || awayTeam || 'Untitled Match');
      const matchDate = sheet.matchDate
        ? new Date(sheet.matchDate + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      // Build other officials list (only values that exist)
      const otherOfficials = [
        sheet.fourthOfficial,
        sheet.ar1,
        sheet.ar2,
        sheet.var,
        sheet.avar,
        sheet.reserveAr,
      ].filter(Boolean);
      const othersHtml = otherOfficials.length > 0
        ? otherOfficials.map(o => `<div class="official-line">${o}</div>`).join('')
        : '—';

        const isComplete = !!sheet.completedAt;
      let deletionBadge = '';
      if (isComplete) {
        const deleteDate = new Date(new Date(sheet.completedAt).getTime() + retentionDays * 86400000);
        const deleteDateStr = deleteDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
        deletionBadge = `<span class="complete-badge" title="Queued for deletion on ${deleteDateStr}">✓ Complete · Deletes ${deleteDateStr}</span>`;
      }

      rows += `
        <tr data-sheet-id="${sheet.id}" class="${selectedSheetId === sheet.id ? 'selected' : ''} ${isComplete ? 'sheet-complete' : ''}">
          <td class="date-cell">${matchDate}</td>
          <td class="fixture-cell ${!homeTeam && !awayTeam ? 'empty' : ''}">
            ${matchLabel}
            ${deletionBadge}
          </td>
          <td class="meta-cell">${sheet.competition || '—'}</td>
          <td class="meta-cell">${sheet.referee || '—'}</td>
          <td class="meta-cell officials-cell">${othersHtml}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-ghost btn-sm btn-open-sheet" data-id="${sheet.id}" title="Open">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                  <path d="M2 10h20"/>
                </svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-edit-sheet" data-id="${sheet.id}" title="Edit Match Details">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4C3.4 4 3 4.4 3 5V20C3 20.6 3.4 21 4 21H19C19.6 21 20 20.6 20 20V13"/>
                  <path d="M18.5 2.5L21.5 5.5L12 15H9V12L18.5 2.5Z"/>
                </svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-complete-sheet ${isComplete ? 'is-complete' : ''}" data-id="${sheet.id}" data-complete="${isComplete}" title="${isComplete ? 'Remove Complete' : 'Mark as Complete'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-row-menu" data-id="${sheet.id}" title="More options">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });




    return `
      <div class="table-wrapper">
        <table class="data-table sheet-table">
          <thead>
            <tr>
              <th style="width: 11%">Date</th>
              <th style="width: 24%">Match</th>
              <th style="width: 14%">Competition</th>
              <th style="width: 12%">Referee</th>
              <th style="width: 20%">Other Match Officials</th>
              <th style="width: 19%"></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Bind events for the manager view
   */
  function bindEvents(container, retentionDays = 30) {
    // Create Running Sheet
    const createBtn = document.getElementById('btn-create-sheet');
    if (createBtn) {
      createBtn.addEventListener('click', showCreateModal);
    }




    // Search filter
    const searchInput = document.getElementById('sheet-search');
    if (searchInput) {
      searchInput.value = searchFilter;
      searchInput.addEventListener('input', (e) => {
        searchFilter = e.target.value.trim();
        const wrapper = document.querySelector('.sheet-list-wrapper');
        if (wrapper) {
          wrapper.innerHTML = renderSheetTable(retentionDays);
          bindTableEvents(container, retentionDays);
        }
      });
    }

    bindTableEvents(container);
  }

  /**
   * Bind table row events
   */
  function bindTableEvents(container, retentionDays = 30) {
    // Open sheet (double-click row or click open button)
    container.querySelectorAll('.sheet-table tbody tr').forEach((row) => {
      row.addEventListener('dblclick', () => {
        const id = row.dataset.sheetId;
        App.openRunningSheet(id);
      });
    });

    container.querySelectorAll('.btn-open-sheet').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.openRunningSheet(btn.dataset.id);
      });
    });

    // 3-dots row menu — portal dropdown (appended to body to escape clipping)
    let portal = document.getElementById('row-menu-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'row-menu-portal';
      portal.className = 'row-dropdown';
      portal.style.display = 'none';
      portal.style.position = 'fixed';
      portal.innerHTML = `
        <button class="row-dropdown-item row-dropdown-danger" id="portal-delete-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6H21M5 6V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V6M8 6V4C8 2.9 8.9 2 10 2H14C15.1 2 16 2.9 16 4V6"/>
          </svg>
          Delete
        </button>
      `;
      document.body.appendChild(portal);
    }

    container.querySelectorAll('.btn-row-menu').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sheetId = btn.dataset.id;
        const rect = btn.getBoundingClientRect();
        const isOpen = portal.style.display !== 'none' && portal.dataset.sheetId === sheetId;

        portal.style.display = 'none';
        if (!isOpen) {
          portal.dataset.sheetId = sheetId;
          portal.style.display = 'block';

          // Measure actual rendered portal size
          const menuW = portal.offsetWidth || 140;
          const menuH = portal.offsetHeight || 44;

          // Prefer below the button, flip above if it would go off-screen
          let top = rect.bottom + 4;
          if (top + menuH > window.innerHeight - 8) {
            top = rect.top - menuH - 4;
          }
          // Align right edge to button right, clamp to viewport left
          let left = rect.right - menuW;
          if (left < 8) left = 8;
          if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;

          portal.style.top = `${top}px`;
          portal.style.left = `${left}px`;
          portal.style.right = 'auto';
        }
      });
    });

    // Portal delete action
    document.getElementById('portal-delete-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const sheetId = portal.dataset.sheetId;
      portal.style.display = 'none';
      const sheet = currentSheets.find(s => s.id === sheetId);
      Modal.confirm({
        title: 'Delete Running Sheet',
        message: `Are you sure you want to delete <strong>${sheet?.homeTeam && sheet?.awayTeam ? sheet.homeTeam + ' vs ' + sheet.awayTeam : 'Untitled Match'}</strong>? This action cannot be undone.`,
        confirmLabel: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          await Storage.deleteRunningSheet(sheetId);
          App.showToast('Running sheet deleted', 'success');
          await refreshList();
        },
      });
    });

    // Close portal on outside click
    document.addEventListener('click', () => {
      if (portal) portal.style.display = 'none';
    }, { capture: false });

    // Edit match details
    container.querySelectorAll('.btn-edit-sheet').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.row-dropdown').forEach(d => d.style.display = 'none');
        showEditMetadataModal(btn.dataset.id);
      });
    });

    // Manage audio files
    container.querySelectorAll('.btn-audio-sheet').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showAudioManagerModal(btn.dataset.id);
      });
    });

    // Mark/Remove complete
    container.querySelectorAll('.btn-complete-sheet').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        document.querySelectorAll('.row-dropdown').forEach(d => d.style.display = 'none');
        const sheetId = btn.dataset.id;
        const isComplete = btn.dataset.complete === 'true';
        const sheet = currentSheets.find(s => s.id === sheetId);
        const label = sheet?.homeTeam && sheet?.awayTeam ? `${sheet.homeTeam} vs ${sheet.awayTeam}` : 'Untitled Match';

        if (isComplete) {
          Modal.confirm({
            title: 'Remove Complete Status',
            message: `Remove the complete status from <strong>${label}</strong>? The sheet will return to active and will no longer be queued for deletion.`,
            confirmLabel: 'Remove Complete',
            confirmClass: 'btn-secondary',
            onConfirm: async () => {
              await Storage.removeComplete(sheetId);
              App.showToast('Complete status removed', 'info');
              await refreshList();
            },
          });
        } else {
          const retentionDays2 = retentionDays;
          const deleteDate = new Date(Date.now() + retentionDays2 * 86400000);
          const deleteDateStr = deleteDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
          Modal.confirm({
            title: 'Mark as Complete',
            message: `Mark <strong>${label}</strong> as complete? It will be queued for automatic deletion after <strong>${retentionDays2} days</strong> (on ${deleteDateStr}). The sheet will remain accessible until then.`,
            confirmLabel: 'Mark Complete',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
              await Storage.markComplete(sheetId);
              App.showToast('Sheet marked as complete', 'success');
              await refreshList();
            },
          });
        }
      });
    });

  }

  /**
   * Show create running sheet modal
   */
  function showCreateModal() {
    const formHtml = `<div class="required-note"><span class="required">*</span> required</div>` + buildMetadataForm({});

    Modal.show({
      title: 'Create Running Sheet',
      body: formHtml,
      width: '600px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => Modal.hide() },
        {
          label: 'Create',
          class: 'btn-primary',
          onClick: async () => {
            const metadata = readMetadataForm();
            // Validate required fields
            const missing = [];
            if (!metadata.matchDate) missing.push('Match Date');
            if (!metadata.competition) missing.push('Competition / Division');
            if (!metadata.homeTeam) missing.push('Home Team');
            if (!metadata.awayTeam) missing.push('Away Team');
            if (!metadata.venue) missing.push('Venue');
            if (!metadata.referee) missing.push('Referee');
            if (missing.length > 0) {
              App.showToast(`Please fill in: ${missing.join(', ')}`, 'warning');
              return;
            }
            const newSheet = await Storage.createRunningSheet(metadata);
            Modal.hide();
            App.showToast('Running sheet created', 'success');
            await refreshList();
            // Go straight to Transcribe
            App.openRunningSheet(newSheet.id);
          },
        },
      ],
    });
  }

  /**
   * Show edit metadata modal
   */
  async function showEditMetadataModal(sheetId) {
    const sheet = currentSheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const formHtml = buildMetadataForm(sheet);

    Modal.show({
      title: 'Edit Match Details',
      body: formHtml,
      width: '600px',
      buttons: [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => Modal.hide() },
        {
          label: 'Save',
          class: 'btn-primary',
          onClick: async () => {
            const metadata = readMetadataForm();
            const fullMeta = { ...sheet, ...metadata };
            await Storage.saveMetadata(sheetId, fullMeta);
            Modal.hide();
            App.showToast('Match details updated', 'success');
            await refreshList();
          },
        },
      ],
    });
  }

  /**
   * Build the metadata form HTML
   */
  function buildMetadataForm(data) {
    return `
      <div class="metadata-form">
        <div class="input-group">
          <label class="input-label" for="meta-match-date">Match Date <span class="required">*</span></label>
          <input type="date" class="input" id="meta-match-date" value="${data.matchDate || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-competition">Competition / Division <span class="required">*</span></label>
          <input type="text" class="input" id="meta-competition" value="${data.competition || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-home-team">Home Team <span class="required">*</span></label>
          <input type="text" class="input" id="meta-home-team" value="${data.homeTeam || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-away-team">Away Team <span class="required">*</span></label>
          <input type="text" class="input" id="meta-away-team" value="${data.awayTeam || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-venue">Venue <span class="required">*</span></label>
          <input type="text" class="input" id="meta-venue" value="${data.venue || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-referee">Referee <span class="required">*</span></label>
          <input type="text" class="input" id="meta-referee" value="${data.referee || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-ar1">Assistant Referee 1</label>
          <input type="text" class="input" id="meta-ar1" value="${data.ar1 || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-ar2">Assistant Referee 2</label>
          <input type="text" class="input" id="meta-ar2" value="${data.ar2 || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-fourth">Fourth Official</label>
          <input type="text" class="input" id="meta-fourth" value="${data.fourthOfficial || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-var">VAR</label>
          <input type="text" class="input" id="meta-var" value="${data.var || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-avar">AVAR</label>
          <input type="text" class="input" id="meta-avar" value="${data.avar || ''}">
        </div>
        <div class="input-group">
          <label class="input-label" for="meta-reserve-ar">Reserve Assistant Referee</label>
          <input type="text" class="input" id="meta-reserve-ar" value="${data.reserveAr || ''}">
        </div>
      </div>
    `;
  }

  /**
   * Read form values
   */
  function readMetadataForm() {
    return {
      matchDate: document.getElementById('meta-match-date')?.value || '',
      homeTeam: document.getElementById('meta-home-team')?.value?.trim() || '',
      awayTeam: document.getElementById('meta-away-team')?.value?.trim() || '',
      venue: document.getElementById('meta-venue')?.value?.trim() || '',
      competition: document.getElementById('meta-competition')?.value?.trim() || '',
      referee: document.getElementById('meta-referee')?.value?.trim() || '',
      fourthOfficial: document.getElementById('meta-fourth')?.value?.trim() || '',
      ar1: document.getElementById('meta-ar1')?.value?.trim() || '',
      ar2: document.getElementById('meta-ar2')?.value?.trim() || '',
      var: document.getElementById('meta-var')?.value?.trim() || '',
      avar: document.getElementById('meta-avar')?.value?.trim() || '',
      reserveAr: document.getElementById('meta-reserve-ar')?.value?.trim() || '',
    };
  }

  /**
   * Show audio file manager modal
   */
  async function showAudioManagerModal(sheetId, onDone) {
    const sheetData = await Storage.openRunningSheet(sheetId);
    let audioFiles = sheetData.audioFiles || [];

    function renderAudioList() {
      if (audioFiles.length === 0) {
        return `
          <div class="empty-state" style="padding: 40px;">
            <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <p class="empty-state-text">No audio files imported yet. Click "Import Folder" to add recordings.</p>
          </div>
        `;
      }

      let items = '';
      audioFiles.forEach((file, index) => {
        const fileName = file.split('\\').pop().split('/').pop();
        items += `
          <div class="audio-file-item" data-index="${index}" draggable="true">
            <span class="file-index">${index + 1}</span>
            <span class="file-name">${fileName}</span>
            <span class="file-path" title="${file}">${file}</span>
            <div class="file-actions">
              <button class="btn btn-ghost btn-sm btn-move-up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15L12 9L6 15"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-move-down" data-index="${index}" title="Move Down" ${index === audioFiles.length - 1 ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9L12 15L18 9"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm btn-remove-file" data-index="${index}" title="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6L18 18" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
        `;
      });

      return `<div class="audio-file-list" id="audio-file-list">${items}</div>`;
    }

    function updateModal() {
      const listContainer = document.getElementById('audio-list-container');
      if (listContainer) {
        listContainer.innerHTML = renderAudioList();
        bindAudioListEvents();
      }
      const countEl = document.getElementById('audio-file-count');
      if (countEl) countEl.textContent = `${audioFiles.length} file${audioFiles.length !== 1 ? 's' : ''}`;
    }

    function bindAudioListEvents() {
      // Move up
      document.querySelectorAll('.btn-move-up').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          if (idx > 0) {
            [audioFiles[idx - 1], audioFiles[idx]] = [audioFiles[idx], audioFiles[idx - 1]];
            await Storage.saveAudioReferences(sheetId, audioFiles);
            updateModal();
          }
        });
      });

      // Move down
      document.querySelectorAll('.btn-move-down').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          if (idx < audioFiles.length - 1) {
            [audioFiles[idx], audioFiles[idx + 1]] = [audioFiles[idx + 1], audioFiles[idx]];
            await Storage.saveAudioReferences(sheetId, audioFiles);
            updateModal();
          }
        });
      });

      // Remove file
      document.querySelectorAll('.btn-remove-file').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.index);
          audioFiles.splice(idx, 1);
          await Storage.saveAudioReferences(sheetId, audioFiles);
          updateModal();
        });
      });

      // Drag and drop
      const items = document.querySelectorAll('.audio-file-item');
      let dragIdx = null;

      items.forEach((item) => {
        item.addEventListener('dragstart', (e) => {
          dragIdx = parseInt(item.dataset.index);
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          document.querySelectorAll('.audio-file-item').forEach(i => i.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });

        item.addEventListener('drop', async (e) => {
          e.preventDefault();
          const dropIdx = parseInt(item.dataset.index);
          if (dragIdx !== null && dragIdx !== dropIdx) {
            const [moved] = audioFiles.splice(dragIdx, 1);
            audioFiles.splice(dropIdx, 0, moved);
            await Storage.saveAudioReferences(sheetId, audioFiles);
            updateModal();
          }
          dragIdx = null;
        });
      });
    }

    const body = `
      <div class="audio-files-section">
        <div class="audio-files-header">
          <span id="audio-file-count" style="font-size: var(--font-size-sm); color: var(--text-secondary);">${audioFiles.length} file${audioFiles.length !== 1 ? 's' : ''}</span>
          <button class="btn btn-secondary btn-sm" id="btn-import-audio-folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z"/>
              <line x1="12" y1="11" x2="12" y2="17" stroke-linecap="round"/>
              <line x1="9" y1="14" x2="15" y2="14" stroke-linecap="round"/>
            </svg>
            Import Folder
          </button>
        </div>
        <div id="audio-list-container">
          ${renderAudioList()}
        </div>
      </div>
    `;

    Modal.show({
      title: 'Audio Files',
      body,
      width: '700px',
      buttons: [
        {
          label: 'Done', class: 'btn-primary', onClick: async () => {
            Modal.hide();
            await refreshList();
            if (onDone) onDone();
          }
        },
      ],
    });

    // Bind import folder button
    document.getElementById('btn-import-audio-folder').addEventListener('click', async () => {
      const folder = await window.api.dialog.selectDirectory('Select Audio Files Folder');
      if (!folder) return;

      const scannedFiles = await window.api.audio.scanFolder(folder);
      if (scannedFiles.length === 0) {
        App.showToast('No supported audio files found in that folder', 'error');
        return;
      }

      // Add new files (avoid duplicates)
      const existingPaths = new Set(audioFiles.map(f => f.toLowerCase()));
      let added = 0;
      scannedFiles.forEach((f) => {
        if (!existingPaths.has(f.path.toLowerCase())) {
          audioFiles.push(f.path);
          existingPaths.add(f.path.toLowerCase());
          added++;
        }
      });

      await Storage.saveAudioReferences(sheetId, audioFiles);
      updateModal();
      bindAudioListEvents();
      App.showToast(`${added} audio file${added !== 1 ? 's' : ''} imported`, 'success');
    });

    bindAudioListEvents();
  }

  /**
   * Refresh the sheet list
   */
  async function refreshList() {
    currentSheets = await Storage.listRunningSheets();
    const container = document.getElementById('page-container');
    renderMainView(container);
  }

  return { render };
})();
