/**
 * Tag Input Component
 * Chip/pill UI with autocomplete from predefined + custom tags.
 * Typing a new tag and pressing Enter adds it to the entry AND to the global tag list.
 */
const TagInput = (() => {

    /**
     * Create a tag input instance
     * @param {HTMLElement} container - The container element to render into
     * @param {Object} options
     * @param {string[]} options.value - Current tags
     * @param {string[]} options.suggestions - Available tag suggestions
     * @param {Function} options.onChange - Called with updated tags array
     * @param {Function} options.onNewTag - Called when a new tag is created (not in suggestions)
     */
    function create(container, { value = [], suggestions = [], onChange, onNewTag }) {
        let currentTags = [...value];
        let filteredSuggestions = [];
        let selectedSuggestionIdx = -1;

        function render() {
            container.innerHTML = '';
            container.className = 'tag-input-wrapper';

            // Render existing tag chips
            currentTags.forEach((tag, idx) => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip';
                chip.innerHTML = `
          ${tag}
          <button class="tag-chip-remove" data-index="${idx}" title="Remove">&times;</button>
        `;
                chip.querySelector('.tag-chip-remove').addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentTags.splice(idx, 1);
                    render();
                    if (onChange) onChange(currentTags);
                });
                container.appendChild(chip);
            });

            // Input field
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tag-input-field';
            input.placeholder = currentTags.length === 0 ? 'Add tags...' : '';
            input.setAttribute('data-tag-input', 'true');
            container.appendChild(input);

            // Dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'tag-dropdown hidden';
            container.appendChild(dropdown);

            // Input events
            input.addEventListener('input', () => {
                const query = input.value.trim().toLowerCase();
                if (query.length === 0) {
                    dropdown.classList.add('hidden');
                    filteredSuggestions = [];
                    return;
                }

                filteredSuggestions = suggestions.filter(
                    s => s.toLowerCase().includes(query) && !currentTags.includes(s)
                );

                if (filteredSuggestions.length === 0) {
                    dropdown.classList.add('hidden');
                    return;
                }

                selectedSuggestionIdx = -1;
                renderDropdown(dropdown, filteredSuggestions, input);
                dropdown.classList.remove('hidden');
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();

                    if (selectedSuggestionIdx >= 0 && filteredSuggestions[selectedSuggestionIdx]) {
                        addTag(filteredSuggestions[selectedSuggestionIdx], input, dropdown);
                    } else if (input.value.trim()) {
                        addTag(input.value.trim().toLowerCase(), input, dropdown);
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (filteredSuggestions.length > 0) {
                        selectedSuggestionIdx = Math.min(selectedSuggestionIdx + 1, filteredSuggestions.length - 1);
                        highlightSuggestion(dropdown);
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (filteredSuggestions.length > 0) {
                        selectedSuggestionIdx = Math.max(selectedSuggestionIdx - 1, 0);
                        highlightSuggestion(dropdown);
                    }
                } else if (e.key === 'Backspace' && input.value === '' && currentTags.length > 0) {
                    currentTags.pop();
                    render();
                    if (onChange) onChange(currentTags);
                } else if (e.key === 'Escape') {
                    dropdown.classList.add('hidden');
                    selectedSuggestionIdx = -1;
                } else if (e.key === 'Tab') {
                    // Allow Tab to pass through for row navigation
                    dropdown.classList.add('hidden');
                }
            });

            input.addEventListener('blur', () => {
                // Delay to allow click on dropdown
                setTimeout(() => dropdown.classList.add('hidden'), 150);
            });

            input.addEventListener('focus', () => {
                const query = input.value.trim().toLowerCase();
                if (query.length > 0 && filteredSuggestions.length > 0) {
                    dropdown.classList.remove('hidden');
                }
            });

            // Click wrapper to focus input
            container.addEventListener('click', (e) => {
                if (e.target === container) input.focus();
            });
        }

        function renderDropdown(dropdown, items, input) {
            dropdown.innerHTML = '';
            items.forEach((item, idx) => {
                const option = document.createElement('div');
                option.className = 'tag-dropdown-item' + (idx === selectedSuggestionIdx ? ' selected' : '');
                option.textContent = item;
                option.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    addTag(item, input, dropdown);
                });
                dropdown.appendChild(option);
            });
        }

        function highlightSuggestion(dropdown) {
            dropdown.querySelectorAll('.tag-dropdown-item').forEach((el, idx) => {
                el.classList.toggle('selected', idx === selectedSuggestionIdx);
            });
        }

        function addTag(tag, input, dropdown) {
            if (!currentTags.includes(tag)) {
                currentTags.push(tag);

                // If it's a new tag not in suggestions, notify
                if (!suggestions.includes(tag)) {
                    suggestions.push(tag);
                    if (onNewTag) onNewTag(tag);
                }

                if (onChange) onChange(currentTags);
            }

            input.value = '';
            dropdown.classList.add('hidden');
            filteredSuggestions = [];
            selectedSuggestionIdx = -1;
            render();

            // Re-focus the input after render
            setTimeout(() => {
                const newInput = container.querySelector('.tag-input-field');
                if (newInput) newInput.focus();
            }, 10);
        }

        render();

        return {
            getTags: () => [...currentTags],
            setTags: (tags) => {
                currentTags = [...tags];
                render();
            },
            setSuggestions: (newSuggestions) => {
                suggestions = newSuggestions;
            },
        };
    }

    return { create };
})();
