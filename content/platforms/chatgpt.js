// ChatGPT Prompt Timeline - Simple sidebar that shows prompts and scrolls to them

class PromptTimeline {
  constructor() {
    this.prompts = [];
    this.sidebar = null;
    this.observer = null;
    this.isVisible = true;
    this.bookmarks = new Set(); // Track bookmarked prompt IDs
    this.showOnlyBookmarks = false; // Filter toggle
    this.conversationId = this.getConversationId(); // Current chat ID
    
    // Resize state
    this.sidebarWidth = 340; // Default width
    this.minWidth = 60; // Minimal mode threshold
    this.maxWidth = 500;
    this.isResizing = false;
    
    this.init();
  }

  async init() {
    console.log('🛤️ PromptTrail: Initializing...');
    
    // Wait for the page to load
    await this.waitForConversation();
    
    // Load saved bookmarks for this conversation
    this.loadBookmarks();
    
    // Load saved sidebar width
    this.loadSidebarWidth();
    
    // Create the sidebar UI
    this.createSidebar();
    
    // Scan existing prompts
    this.scanExistingPrompts();
    
    // Watch for new prompts
    this.setupObserver();
    
    console.log('🛤️ PromptTrail: Ready!', { promptCount: this.prompts.length });
    
    // Auto-rescan after a delay to catch late-loading messages
    setTimeout(() => {
      const prevCount = this.prompts.length;
      this.rescan();
      if (this.prompts.length > prevCount) {
        console.log('🛤️ PromptTrail: Found', this.prompts.length - prevCount, 'more prompts after delay');
      }
    }, 2000);
  }

  waitForConversation() {
    return new Promise((resolve) => {
      const check = () => {
        const main = document.querySelector('main');
        if (main) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }
  
  getConversationId() {
    // Extract conversation ID from URL: /c/abc123 or /g/abc123
    const match = window.location.pathname.match(/\/[cg]\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : 'default';
  }
  
  getStorageKey() {
    return `prompttrail-bookmarks-${this.conversationId}`;
  }
  
  loadBookmarks() {
    try {
      const saved = localStorage.getItem(this.getStorageKey());
      if (saved) {
        const bookmarkIds = JSON.parse(saved);
        this.bookmarks = new Set(bookmarkIds);
        console.log('🛤️ PromptTrail: Loaded', this.bookmarks.size, 'bookmarks');
      }
    } catch (e) {
      console.warn('🛤️ PromptTrail: Could not load bookmarks', e);
    }
  }
  
  saveBookmarks() {
    try {
      const bookmarkIds = Array.from(this.bookmarks);
      localStorage.setItem(this.getStorageKey(), JSON.stringify(bookmarkIds));
      console.log('🛤️ PromptTrail: Saved', bookmarkIds.length, 'bookmarks');
    } catch (e) {
      console.warn('🛤️ PromptTrail: Could not save bookmarks', e);
    }
  }
  
  loadSidebarWidth() {
    try {
      const saved = localStorage.getItem('prompttrail-sidebar-width');
      if (saved) {
        const width = parseInt(saved, 10);
        if (width >= this.minWidth && width <= this.maxWidth) {
          this.sidebarWidth = width;
        }
      }
    } catch (e) {
      console.warn('🛤️ PromptTrail: Could not load sidebar width', e);
    }
  }
  
  saveSidebarWidth() {
    try {
      localStorage.setItem('prompttrail-sidebar-width', this.sidebarWidth.toString());
    } catch (e) {
      console.warn('🛤️ PromptTrail: Could not save sidebar width', e);
    }
  }
  
  isMinimalMode() {
    return this.sidebarWidth <= 100;
  }
  
  updateSidebarWidth() {
    if (!this.sidebar) return;
    
    const isMinimal = this.isMinimalMode();
    
    this.sidebar.style.width = `${this.sidebarWidth}px`;
    this.sidebar.classList.toggle('pts-minimal', isMinimal);
    
    // Re-render prompt list for minimal mode
    this.renderPromptList();
  }
  
  setupResizeHandle() {
    const handle = this.sidebar.querySelector('.pts-resize-handle');
    if (!handle) return;
    
    let startX, startWidth;
    
    const onMouseMove = (e) => {
      if (!this.isResizing) return;
      
      const deltaX = startX - e.clientX;
      let newWidth = startWidth + deltaX;
      
      // Clamp to min/max
      newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));
      
      this.sidebarWidth = newWidth;
      this.updateSidebarWidth();
    };
    
    const onMouseUp = () => {
      if (!this.isResizing) return;
      
      this.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      this.sidebar.classList.remove('pts-resizing');
      
      // Save the width
      this.saveSidebarWidth();
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isResizing = true;
      startX = e.clientX;
      startWidth = this.sidebarWidth;
      
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      this.sidebar.classList.add('pts-resizing');
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
  
  getStableMessageId(element) {
    // Try to get ChatGPT's message ID from various attributes
    
    // 1. Direct message ID on the element
    let messageId = element.getAttribute('data-message-id');
    if (messageId) return messageId;
    
    // 2. Look in parent conversation turn
    const conversationTurn = element.closest('[data-testid^="conversation-turn"]');
    if (conversationTurn) {
      const testId = conversationTurn.getAttribute('data-testid');
      if (testId) return testId;
    }
    
    // 3. Look for any parent with data-message-id
    const parentWithId = element.closest('[data-message-id]');
    if (parentWithId) {
      messageId = parentWithId.getAttribute('data-message-id');
      if (messageId) return messageId;
    }
    
    // 4. Fallback: create a hash from the text content (first 100 chars)
    const text = element.textContent?.trim().substring(0, 100) || '';
    return 'hash-' + this.hashString(text);
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  createSidebar() {
    // Remove existing sidebar if any
    const existing = document.getElementById('prompt-timeline-sidebar');
    if (existing) existing.remove();

    // Create sidebar container
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'prompt-timeline-sidebar';
    this.sidebar.innerHTML = `
      <div class="pts-header">
        <div class="pts-title">
          <svg class="pts-logo" viewBox="0 0 557 557" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M425.764 0H130.336C58.353 0 0 58.353 0 130.336V425.764C0 497.746 58.353 556.1 130.336 556.1H425.764C497.746 556.1 556.1 497.746 556.1 425.764V130.336C556.1 58.353 497.746 0 425.764 0Z" fill="url(#grad1)"/>
            <path opacity="0.25" d="M413.632 104.365H247.127C240.558 104.365 235.233 109.69 235.233 116.258C235.233 122.827 240.558 128.151 247.127 128.151H413.632C420.2 128.151 425.525 122.827 425.525 116.258C425.525 109.69 420.2 104.365 413.632 104.365Z" fill="white"/>
            <path opacity="0.2" d="M168.447 154.317C189.466 154.317 206.506 137.278 206.506 116.259C206.506 95.24 189.466 78.2 168.447 78.2C147.428 78.2 130.389 95.24 130.389 116.259C130.389 137.278 147.428 154.317 168.447 154.317Z" fill="white"/>
            <path opacity="0.2" d="M168.447 306.639C189.466 306.639 206.506 289.6 206.506 268.58C206.506 247.561 189.466 230.522 168.447 230.522C147.428 230.522 130.389 247.561 130.389 268.58C130.389 289.6 147.428 306.639 168.447 306.639Z" fill="white"/>
            <path opacity="0.25" d="M375.573 256.687H247.127C240.558 256.687 235.233 262.012 235.233 268.58C235.233 275.148 240.558 280.473 247.127 280.473H375.573C382.142 280.473 387.466 275.148 387.466 268.58C387.466 262.012 382.142 256.687 375.573 256.687Z" fill="white"/>
            <path opacity="0.18" d="M168.627 477.899C200.156 477.899 225.715 452.34 225.715 420.811C225.715 389.283 200.156 363.724 168.627 363.724C137.099 363.724 111.54 389.283 111.54 420.811C111.54 452.34 137.099 477.899 168.627 477.899Z" fill="white"/>
            <path opacity="0.95" d="M168.63 458.869C189.649 458.869 206.688 441.83 206.688 420.811C206.688 399.792 189.649 382.752 168.63 382.752C147.611 382.752 130.571 399.792 130.571 420.811C130.571 441.83 147.611 458.869 168.63 458.869Z" fill="white"/>
            <path d="M168.635 437.936C178.094 437.936 185.762 430.268 185.762 420.81C185.762 411.351 178.094 403.683 168.635 403.683C159.177 403.683 151.509 411.351 151.509 420.81C151.509 430.268 159.177 437.936 168.635 437.936Z" fill="#524CE7"/>
            <path opacity="0.95" d="M432.661 397.024H247.127C240.558 397.024 235.233 402.349 235.233 408.918C235.233 415.486 240.558 420.811 247.127 420.811H432.661C439.229 420.811 444.554 415.486 444.554 408.918C444.554 402.349 439.229 397.024 432.661 397.024Z" fill="white"/>
            <path opacity="0.55" d="M368.437 439.84H244.748C239.493 439.84 235.233 444.099 235.233 449.354C235.233 454.609 239.493 458.869 244.748 458.869H368.437C373.692 458.869 377.952 454.609 377.952 449.354C377.952 444.099 373.692 439.84 368.437 439.84Z" fill="white"/>
            <path opacity="0.2" d="M176.623 231.363C174.046 230.812 171.372 230.519 168.63 230.519C165.889 230.519 163.216 230.811 160.64 231.362V153.725C163.229 154.216 165.9 154.482 168.632 154.482C171.364 154.482 174.034 154.216 176.623 153.725V231.363Z" fill="white"/>
            <path opacity="0.2" d="M176.623 364.287C174.046 363.871 171.372 363.651 168.63 363.651C165.889 363.651 163.216 363.871 160.64 364.286V305.661C163.229 306.032 165.9 306.233 168.632 306.233C171.364 306.233 174.034 306.032 176.623 305.661V364.287Z" fill="white"/>
            <defs><linearGradient id="grad1" x1="0" y1="0" x2="556.1" y2="556.1"><stop stop-color="#7B77F0"/><stop offset="1" stop-color="#3A35C8"/></linearGradient></defs>
          </svg>
          <span class="pts-title-text">Prompt Trail</span>
          <span class="pts-count" id="pts-count">0</span>
        </div>
        <div class="pts-header-actions">
          <button class="pts-filter-bookmarks" title="Show bookmarked only">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="pts-rescan" title="Rescan prompts">↻</button>
          <button class="pts-collapse" title="Collapse to timeline">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="13 17 18 12 13 7"/>
              <polyline points="6 17 11 12 6 7"/>
            </svg>
          </button>
          <button class="pts-minimize" title="Minimize to icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="pts-content">
        <div class="pts-timeline" id="pts-prompt-list">
          <div class="pts-empty">No prompts yet</div>
        </div>
      </div>
      <svg class="pts-collapsed-icon" viewBox="0 0 557 557" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M425.764 0H130.336C58.353 0 0 58.353 0 130.336V425.764C0 497.746 58.353 556.1 130.336 556.1H425.764C497.746 556.1 556.1 497.746 556.1 425.764V130.336C556.1 58.353 497.746 0 425.764 0Z" fill="url(#grad2)"/>
        <path opacity="0.25" d="M413.632 104.365H247.127C240.558 104.365 235.233 109.69 235.233 116.258C235.233 122.827 240.558 128.151 247.127 128.151H413.632C420.2 128.151 425.525 122.827 425.525 116.258C425.525 109.69 420.2 104.365 413.632 104.365Z" fill="white"/>
        <path opacity="0.2" d="M168.447 154.317C189.466 154.317 206.506 137.278 206.506 116.259C206.506 95.24 189.466 78.2 168.447 78.2C147.428 78.2 130.389 95.24 130.389 116.259C130.389 137.278 147.428 154.317 168.447 154.317Z" fill="white"/>
        <path opacity="0.2" d="M168.447 306.639C189.466 306.639 206.506 289.6 206.506 268.58C206.506 247.561 189.466 230.522 168.447 230.522C147.428 230.522 130.389 247.561 130.389 268.58C130.389 289.6 147.428 306.639 168.447 306.639Z" fill="white"/>
        <path opacity="0.25" d="M375.573 256.687H247.127C240.558 256.687 235.233 262.012 235.233 268.58C235.233 275.148 240.558 280.473 247.127 280.473H375.573C382.142 280.473 387.466 275.148 387.466 268.58C387.466 262.012 382.142 256.687 375.573 256.687Z" fill="white"/>
        <path opacity="0.18" d="M168.627 477.899C200.156 477.899 225.715 452.34 225.715 420.811C225.715 389.283 200.156 363.724 168.627 363.724C137.099 363.724 111.54 389.283 111.54 420.811C111.54 452.34 137.099 477.899 168.627 477.899Z" fill="white"/>
        <path opacity="0.95" d="M168.63 458.869C189.649 458.869 206.688 441.83 206.688 420.811C206.688 399.792 189.649 382.752 168.63 382.752C147.611 382.752 130.571 399.792 130.571 420.811C130.571 441.83 147.611 458.869 168.63 458.869Z" fill="white"/>
        <path d="M168.635 437.936C178.094 437.936 185.762 430.268 185.762 420.81C185.762 411.351 178.094 403.683 168.635 403.683C159.177 403.683 151.509 411.351 151.509 420.81C151.509 430.268 159.177 437.936 168.635 437.936Z" fill="#524CE7"/>
        <path opacity="0.95" d="M432.661 397.024H247.127C240.558 397.024 235.233 402.349 235.233 408.918C235.233 415.486 240.558 420.811 247.127 420.811H432.661C439.229 420.811 444.554 415.486 444.554 408.918C444.554 402.349 439.229 397.024 432.661 397.024Z" fill="white"/>
        <path opacity="0.55" d="M368.437 439.84H244.748C239.493 439.84 235.233 444.099 235.233 449.354C235.233 454.609 239.493 458.869 244.748 458.869H368.437C373.692 458.869 377.952 454.609 377.952 449.354C377.952 444.099 373.692 439.84 368.437 439.84Z" fill="white"/>
        <path opacity="0.2" d="M176.623 231.363C174.046 230.812 171.372 230.519 168.63 230.519C165.889 230.519 163.216 230.811 160.64 231.362V153.725C163.229 154.216 165.9 154.482 168.632 154.482C171.364 154.482 174.034 154.216 176.623 153.725V231.363Z" fill="white"/>
        <path opacity="0.2" d="M176.623 364.287C174.046 363.871 171.372 363.651 168.63 363.651C165.889 363.651 163.216 363.871 160.64 364.286V305.661C163.229 306.032 165.9 306.233 168.632 306.233C171.364 306.233 174.034 306.032 176.623 305.661V364.287Z" fill="white"/>
        <defs><linearGradient id="grad2" x1="0" y1="0" x2="556.1" y2="556.1"><stop stop-color="#7B77F0"/><stop offset="1" stop-color="#3A35C8"/></linearGradient></defs>
      </svg>
      <div class="pts-resize-handle"></div>
      <button class="pts-expand-btn" title="Expand sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    `;

    // Add styles
    this.addStyles();

    // Add to page
    document.body.appendChild(this.sidebar);
    
    // Apply initial width and mode
    this.updateSidebarWidth();

    // Setup button handlers
    this.sidebar.querySelector('.pts-collapse').addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapseToTimeline();
    });
    
    this.sidebar.querySelector('.pts-minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeToIcon();
    });

    this.sidebar.querySelector('.pts-rescan').addEventListener('click', (e) => {
      e.stopPropagation();
      this.rescan();
    });

    this.sidebar.querySelector('.pts-filter-bookmarks').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleBookmarkFilter();
    });
    
    // Click on collapsed sidebar to expand
    this.sidebar.addEventListener('click', (e) => {
      if (this.sidebar.classList.contains('pts-collapsed')) {
        this.toggle();
      }
    });

    // Keyboard shortcut: Ctrl+Shift+P to toggle
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.toggle();
      }
    });
    
    // Setup resize handle
    this.setupResizeHandle();
    
    // Expand button (for minimal mode)
    this.sidebar.querySelector('.pts-expand-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandToFull();
    });

    console.log('🛤️ PromptTrail: Sidebar created');
  }

  addStyles() {
    const styleId = 'prompt-timeline-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      #prompt-timeline-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 340px;
        height: 100vh;
        background: #0d1117;
        border-left: 1px solid #21262d;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        box-shadow: -4px 0 24px rgba(0,0,0,0.5);
        transition: all 0.3s ease;
        border-radius: 0;
      }

      /* Collapsed state - small square button */
      #prompt-timeline-sidebar.pts-collapsed {
        width: 48px;
        height: 48px;
        min-width: 48px;
        top: 50%;
        transform: translateY(-50%);
        border-radius: 12px 0 0 12px;
        cursor: pointer;
        overflow: hidden;
      }

      #prompt-timeline-sidebar.pts-collapsed .pts-header,
      #prompt-timeline-sidebar.pts-collapsed .pts-content {
        display: none;
      }

      /* Collapsed indicator - SVG icon */
      #prompt-timeline-sidebar.pts-collapsed .pts-collapsed-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 32px;
        height: 32px;
        border-radius: 6px;
      }

      /* Collapsed sidebar hover effect */
      #prompt-timeline-sidebar.pts-collapsed:hover {
        background: #161b22;
        border-left-color: #7B77F0;
        box-shadow: -4px 0 16px rgba(31, 111, 235, 0.3);
      }

      /* Fully hidden state */
      #prompt-timeline-sidebar.pts-hidden {
        transform: translateX(100%);
      }

      .pts-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: #161b22;
        border-bottom: 1px solid #21262d;
        flex-shrink: 0;
      }

      .pts-title {
        font-size: 14px;
        font-weight: 600;
        color: #c9d1d9;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .pts-logo {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        border-radius: 4px;
      }

      /* Hide collapsed icon when expanded */
      .pts-collapsed-icon {
        display: none;
      }

      #prompt-timeline-sidebar.pts-collapsed .pts-collapsed-icon {
        display: block;
      }

      .pts-count {
        background: #21262d;
        color: #8b949e;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 10px;
      }

      .pts-header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .pts-collapse, .pts-minimize, .pts-rescan, .pts-filter-bookmarks {
        background: none;
        border: none;
        color: #8b949e;
        font-size: 16px;
        cursor: pointer;
        padding: 6px 8px;
        border-radius: 6px;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pts-filter-bookmarks svg,
      .pts-collapse svg,
      .pts-minimize svg {
        width: 14px;
        height: 14px;
      }

      .pts-collapse:hover, .pts-minimize:hover, .pts-rescan:hover, .pts-filter-bookmarks:hover {
        color: #c9d1d9;
        background: #21262d;
      }
      
      .pts-filter-bookmarks.pts-filter-active {
        color: #f0b429;
        background: rgba(240, 180, 41, 0.15);
      }
      
      .pts-filter-bookmarks.pts-filter-active svg {
        fill: #f0b429;
      }

      .pts-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }

      .pts-content::-webkit-scrollbar {
        width: 8px;
      }

      .pts-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .pts-content::-webkit-scrollbar-thumb {
        background: #30363d;
        border-radius: 4px;
        border: 2px solid #0d1117;
      }

      .pts-content::-webkit-scrollbar-thumb:hover {
        background: #484f58;
      }

      .pts-empty {
        color: #8b949e;
        text-align: center;
        padding: 40px 20px;
        font-size: 13px;
      }

      /* Timeline wrapper */
      .pts-timeline {
        position: relative;
        margin-left: 8px;
      }

      .pts-prompt-item {
        position: relative;
        margin-left: 28px;
        margin-bottom: 8px;
        padding: 12px 16px;
        background: #161b22;
        border: 1px solid #21262d;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }

      .pts-prompt-item:hover {
        background: #1c2128;
        border-color: #388bfd;
      }

      /* Timeline node - the circle */
      .pts-prompt-item::before {
        content: '';
        position: absolute;
        left: -22px;
        top: 16px;
        width: 12px;
        height: 12px;
        background: #0d1117;
        border: 2px solid #7B77F0;
        border-radius: 50%;
        z-index: 2;
      }

      .pts-prompt-item:hover::before {
        background: #7B77F0;
        box-shadow: 0 0 10px rgba(31, 111, 235, 0.5);
      }

      /* Connecting line - passes through center of circles */
      .pts-prompt-item::after {
        content: '';
        position: absolute;
        left: -17px;
        top: 22px;
        width: 2px;
        height: calc(100% + 2px);
        background: #7B77F0;
        z-index: 1;
      }

      /* No line after the last item */
      .pts-prompt-item:last-child::after {
        display: none;
      }

      /* Prompt number badge */
      .pts-prompt-num {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        color: #8b949e;
        margin-bottom: 8px;
      }

      .pts-prompt-num span {
        background: #7B77F0;
        color: #fff;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
      }

      .pts-prompt-text {
        font-size: 13px;
        color: #c9d1d9;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
        transition: all 0.3s ease;
      }

      /* Expand on hover */
      .pts-prompt-item:hover .pts-prompt-text {
        -webkit-line-clamp: 8;
        color: #f0f6fc;
      }

      .pts-prompt-item.pts-active {
        background: #0c2d6b;
        border-color: #388bfd;
      }

      .pts-prompt-item.pts-active::before {
        background: #388bfd;
        border-color: #388bfd;
        box-shadow: 0 0 12px rgba(56, 139, 253, 0.6);
      }

      /* Highlight animation */
      @keyframes pts-highlight {
        0%, 100% { box-shadow: none; }
        50% { box-shadow: 0 0 0 4px rgba(56, 139, 253, 0.3); }
      }

      .pts-highlight-flash {
        animation: pts-highlight 0.6s ease-in-out 3;
      }

      /* Prompt header with number and actions */
      .pts-prompt-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      /* Action buttons container */
      .pts-prompt-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .pts-prompt-item:hover .pts-prompt-actions {
        opacity: 1;
      }

      /* Action button base */
      .pts-btn {
        background: transparent;
        border: none;
        width: 28px;
        height: 28px;
        padding: 5px;
        border-radius: 6px;
        cursor: pointer;
        color: #8b949e;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pts-btn:hover {
        background: #21262d;
        color: #c9d1d9;
      }

      .pts-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Bookmark button */
      .pts-bookmark.pts-bookmarked {
        color: #f0b429;
      }

      .pts-bookmark.pts-bookmarked svg {
        fill: #f0b429;
      }

      /* Copy button feedback */
      .pts-copy.pts-copied {
        color: #3fb950;
        background: rgba(63, 185, 80, 0.15);
      }

      /* Toast notification */
      .pts-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #161b22;
        color: #c9d1d9;
        padding: 12px 24px;
        border-radius: 8px;
        border: 1px solid #30363d;
        font-size: 13px;
        z-index: 10001;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      }

      .pts-toast-show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* Bookmarked indicator on timeline node */
      .pts-prompt-item.pts-is-bookmarked::before {
        border-color: #f0b429;
        background: #f0b429;
        box-shadow: 0 0 8px rgba(240, 180, 41, 0.5);
      }

      /* Resize handle */
      .pts-resize-handle {
        position: absolute;
        left: 0;
        top: 0;
        width: 6px;
        height: 100%;
        cursor: ew-resize;
        background: transparent;
        transition: background 0.2s;
        z-index: 10;
      }

      .pts-resize-handle:hover,
      #prompt-timeline-sidebar.pts-resizing .pts-resize-handle {
        background: #7B77F0;
      }

      #prompt-timeline-sidebar.pts-resizing {
        transition: none;
      }

      /* Minimal mode - floating dots only, no background */
      #prompt-timeline-sidebar.pts-minimal {
        background: transparent;
        border: none;
        box-shadow: none;
        width: auto !important;
        min-width: 24px;
        overflow: visible;
        top: 50%;
        transform: translateY(-50%);
        height: auto;
        max-height: 80vh;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-header {
        display: none;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-content {
        padding: 12px 6px;
        overflow: visible;
        background: transparent;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-resize-handle {
        display: none;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-timeline {
        margin-left: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-empty {
        display: none;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item {
        width: 14px;
        height: 14px;
        min-height: 14px;
        margin: 0;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: 50%;
        position: relative;
        transition: transform 0.15s;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item:hover {
        transform: scale(1.3);
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item::before {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item::after {
        left: 50%;
        top: 100%;
        transform: translateX(-50%);
        width: 2px;
        height: 4px;
        background: rgba(123, 119, 240, 0.5);
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item:last-child::after {
        display: none;
      }

      /* Hide collapsed icon in minimal mode */
      #prompt-timeline-sidebar.pts-minimal .pts-collapsed-icon {
        display: none;
      }

      /* Expand button - only visible in minimal mode */
      .pts-expand-btn {
        display: none;
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 6px;
        padding: 4px;
        cursor: pointer;
        color: #8b949e;
        transition: all 0.2s;
        z-index: 10;
      }

      .pts-expand-btn:hover {
        background: #21262d;
        color: #c9d1d9;
        border-color: #7B77F0;
      }

      .pts-expand-btn svg {
        width: 14px;
        height: 14px;
        display: block;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-expand-btn {
        display: block;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-header,
      #prompt-timeline-sidebar.pts-minimal .pts-prompt-text {
        display: none;
      }

      /* Minimal mode hover tooltip */
      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item .pts-minimal-tooltip {
        position: absolute;
        right: calc(100% + 8px);
        top: 50%;
        transform: translateY(-50%);
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 8px;
        padding: 6px 10px;
        width: 220px;
        max-width: 220px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s, visibility 0.15s;
        pointer-events: none;
        box-shadow: -4px 0 16px rgba(0,0,0,0.3);
        z-index: 100;
        font-size: 11px;
      }

      /* Hover bridge - invisible area between dot and tooltip */
      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item .pts-minimal-tooltip::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 0;
        width: 16px;
        height: 100%;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item:hover .pts-minimal-tooltip,
      #prompt-timeline-sidebar.pts-minimal .pts-prompt-item .pts-minimal-tooltip:hover {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .pts-minimal-tooltip .pts-tooltip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .pts-minimal-tooltip .pts-tooltip-badge {
        background: #7B77F0;
        color: #fff;
        font-size: 10px;
        font-weight: 600;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .pts-minimal-tooltip .pts-tooltip-actions {
        display: flex;
        gap: 2px;
      }

      #prompt-timeline-sidebar.pts-minimal .pts-minimal-tooltip .pts-tooltip-text {
        font-size: 11px !important;
        color: #c9d1d9 !important;
        line-height: 1.5 !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 4 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
        word-break: break-word !important;
      }

      .pts-minimal-tooltip .pts-btn {
        width: 22px;
        height: 22px;
        padding: 3px;
      }

      .pts-minimal-tooltip .pts-btn svg {
        width: 14px;
        height: 14px;
      }
    `;

    document.head.appendChild(styles);
  }

  collapseToTimeline() {
    // Switch to minimal timeline view
    this.sidebar.classList.remove('pts-collapsed');
    this.sidebarWidth = this.minWidth;
    this.updateSidebarWidth();
    this.saveSidebarWidth();
  }
  
  minimizeToIcon() {
    // Minimize to small square icon
    this.sidebar.classList.remove('pts-minimal');
    this.sidebar.classList.add('pts-collapsed');
    this.sidebar.style.width = ''; // Clear inline width so CSS class takes effect
    this.isVisible = false;
  }
  
  expandToFull() {
    // Expand to full sidebar
    this.sidebar.classList.remove('pts-collapsed');
    this.sidebar.classList.remove('pts-minimal');
    this.sidebarWidth = 340;
    this.updateSidebarWidth();
    this.saveSidebarWidth();
    this.isVisible = true;
  }
  
  toggle() {
    // Legacy toggle - now used for keyboard shortcut and collapsed state click
    const isCollapsed = this.sidebar.classList.contains('pts-collapsed');
    
    if (isCollapsed) {
      this.expandToFull();
    } else if (this.isMinimalMode()) {
      this.expandToFull();
    } else {
      this.minimizeToIcon();
    }
  }

  scanExistingPrompts() {
    // Multiple selectors to find user messages (ChatGPT DOM varies)
    const selectors = [
      '[data-message-author-role="user"]',
      'article[data-testid^="conversation-turn"]:has([data-message-author-role="user"])',
      'div[data-message-author-role="user"]',
      '.agent-turn [data-message-author-role="user"]'
    ];
    
    let userMessages = new Set();
    
    // Try each selector
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          // Get the actual message container
          const msgEl = el.matches('[data-message-author-role="user"]') 
            ? el 
            : el.querySelector('[data-message-author-role="user"]');
          if (msgEl) userMessages.add(msgEl);
        });
      } catch (e) {
        console.log('🛤️ PromptTrail: Selector failed:', selector);
      }
    }
    
    // Convert to array and sort by DOM position
    const sortedMessages = Array.from(userMessages).sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    
    console.log('🛤️ PromptTrail: Found', sortedMessages.length, 'existing prompts');
    
    sortedMessages.forEach((msgElement, index) => {
      this.addPromptFromElement(msgElement, index);
    });

    this.renderPromptList();
  }
  
  rescan() {
    console.log('🛤️ PromptTrail: Rescanning...');
    this.prompts = [];
    this.scanExistingPrompts();
  }

  addPromptFromElement(element, index = null) {
    // Get stable message ID from ChatGPT's DOM
    const messageId = this.getStableMessageId(element);
    
    // Check if we already have this prompt (by ID)
    const existing = this.prompts.find(p => p.id === messageId);
    if (existing) return existing;
    
    // Multiple ways to extract text (ChatGPT DOM varies)
    const textSelectors = [
      '[data-message-content]',
      '.whitespace-pre-wrap',
      '.text-base',
      '.markdown',
      'div.min-h-8',
      'p'
    ];
    
    let text = '';
    for (const selector of textSelectors) {
      const container = element.querySelector(selector);
      if (container?.textContent?.trim()) {
        text = container.textContent.trim();
        break;
      }
    }
    
    // Fallback to element's own text
    if (!text) {
      text = element.textContent?.trim() || '';
    }
    
    if (!text) {
      console.log('🛤️ PromptTrail: Could not extract text from element', element);
      return null;
    }

    // Try to extract timestamp from DOM
    const timestamp = this.extractTimestamp(element);

    const prompt = {
      id: messageId,
      text: text,
      timestamp: timestamp,
      element: element,
      index: index !== null ? index : this.prompts.length
    };

    this.prompts.push(prompt);
    console.log('🛤️ PromptTrail: Added prompt:', text.substring(0, 50) + '...', 'timestamp:', timestamp);
    return prompt;
  }
  
  extractTimestamp(element) {
    // Try to find timestamp in various places
    
    // 1. Check for time element in the message or nearby
    const conversationTurn = element.closest('[data-testid^="conversation-turn"]') || 
                             element.closest('article') ||
                             element.parentElement?.parentElement?.parentElement;
    
    if (conversationTurn) {
      // Look for time element
      const timeEl = conversationTurn.querySelector('time');
      if (timeEl) {
        const datetime = timeEl.getAttribute('datetime');
        if (datetime) return new Date(datetime);
        const title = timeEl.getAttribute('title');
        if (title) return new Date(title);
      }
      
      // Look for title attribute with date
      const titleEl = conversationTurn.querySelector('[title]');
      if (titleEl) {
        const title = titleEl.getAttribute('title');
        const parsed = Date.parse(title);
        if (!isNaN(parsed)) return new Date(parsed);
      }
    }
    
    // 2. Check data attributes on message itself
    const msgId = element.getAttribute('data-message-id');
    if (msgId) {
      // Some IDs are UUIDs with timestamp component (first 8 chars can be hex timestamp)
      // UUID v1 has timestamp, but ChatGPT likely uses v4 (random)
      console.log('🛤️ PromptTrail: Message ID:', msgId);
    }
    
    // 3. Look for any element with datetime-like content near the message
    const parent = element.closest('[class*="group"]') || element.parentElement;
    if (parent) {
      const allText = parent.innerText;
      // Look for time patterns like "2:30 PM" or "Yesterday" or dates
      const timePatterns = [
        /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
        /(Today|Yesterday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/
      ];
      
      for (const pattern of timePatterns) {
        const match = allText.match(pattern);
        if (match) {
          console.log('🛤️ PromptTrail: Found time pattern:', match[1]);
        }
      }
    }
    
    // Fallback: no timestamp found
    return null;
  }

  setupObserver() {
    // Watch for new messages being added to the conversation
    const conversationContainer = document.querySelector('main') || document.body;

    this.observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this node or its children contain a user message
            const userMsg = node.matches?.('[data-message-author-role="user"]') 
              ? node 
              : node.querySelector?.('[data-message-author-role="user"]');
            
            if (userMsg && !this.prompts.find(p => p.element === userMsg)) {
              this.addPromptFromElement(userMsg);
              shouldUpdate = true;
            }
          }
        });
      });

      if (shouldUpdate) {
        this.renderPromptList();
      }
    });

    this.observer.observe(conversationContainer, {
      childList: true,
      subtree: true
    });

    console.log('🛤️ PromptTrail: Observer active');
  }

  renderPromptList() {
    const container = document.getElementById('pts-prompt-list');
    const countEl = document.getElementById('pts-count');
    if (!container) return;

    // Filter prompts if bookmark filter is active
    const displayPrompts = this.showOnlyBookmarks 
      ? this.prompts.filter(p => this.bookmarks.has(p.id))
      : this.prompts;

    // Update count badge (show filtered/total when filtering)
    if (countEl) {
      if (this.showOnlyBookmarks && this.bookmarks.size > 0) {
        countEl.textContent = `${displayPrompts.length}/${this.prompts.length}`;
      } else {
        countEl.textContent = this.prompts.length;
      }
    }

    if (displayPrompts.length === 0) {
      if (this.showOnlyBookmarks) {
        container.innerHTML = '<div class="pts-empty">No bookmarks yet.<br><small style="color:#6e7681">Click the bookmark icon on a prompt to save it.</small></div>';
      } else {
        container.innerHTML = '<div class="pts-empty">No prompts yet.<br><small style="color:#6e7681">Start a conversation!</small></div>';
      }
      return;
    }

    const isMinimal = this.isMinimalMode();
    
    container.innerHTML = displayPrompts.map((prompt, idx) => `
      <div class="pts-prompt-item ${this.bookmarks.has(prompt.id) ? 'pts-is-bookmarked' : ''}" data-prompt-id="${prompt.id}">
        <div class="pts-prompt-header">
          <div class="pts-prompt-num"><span>${idx + 1}</span></div>
          <div class="pts-prompt-actions">
            <button class="pts-btn pts-bookmark ${this.bookmarks.has(prompt.id) ? 'pts-bookmarked' : ''}" data-action="bookmark" title="Bookmark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="pts-btn pts-copy" data-action="copy" title="Copy to input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="pts-prompt-text">${this.escapeHtml(prompt.text)}</div>
        ${isMinimal ? `
          <div class="pts-minimal-tooltip">
            <div class="pts-tooltip-header">
              <span class="pts-tooltip-badge">${idx + 1}</span>
              <div class="pts-tooltip-actions">
                <button class="pts-btn pts-bookmark ${this.bookmarks.has(prompt.id) ? 'pts-bookmarked' : ''}" data-action="bookmark" title="Bookmark">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
                <button class="pts-btn pts-copy" data-action="copy" title="Copy to input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="pts-tooltip-text" style="font-size: 11px !important;">${this.escapeHtml(prompt.text)}</div>
          </div>
        ` : ''}
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.pts-prompt-item').forEach((item) => {
      const promptId = item.dataset.promptId;
      
      // Click on item (but not buttons) scrolls to prompt
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.pts-btn')) {
          this.scrollToPrompt(promptId);
        }
      });
      
      // Bookmark buttons (may be multiple in minimal mode)
      item.querySelectorAll('.pts-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleBookmark(promptId);
        });
      });
      
      // Copy buttons (may be multiple in minimal mode)
      item.querySelectorAll('.pts-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.copyToInput(promptId);
        });
      });
    });
  }
  
  toggleBookmark(promptId) {
    if (this.bookmarks.has(promptId)) {
      this.bookmarks.delete(promptId);
      console.log('🛤️ PromptTrail: Removed bookmark', promptId);
    } else {
      this.bookmarks.add(promptId);
      console.log('🛤️ PromptTrail: Added bookmark', promptId);
    }
    
    // Save to localStorage
    this.saveBookmarks();
    
    // Update UI
    const item = document.querySelector(`[data-prompt-id="${promptId}"]`);
    if (item) {
      const btn = item.querySelector('.pts-bookmark');
      const isBookmarked = this.bookmarks.has(promptId);
      btn.classList.toggle('pts-bookmarked', isBookmarked);
      item.classList.toggle('pts-is-bookmarked', isBookmarked);
    }
  }
  
  copyToInput(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    // Find ChatGPT's input textarea
    const inputSelectors = [
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'div[contenteditable="true"][data-placeholder]',
      'textarea[placeholder*="Message"]',
      'div#prompt-textarea'
    ];
    
    let input = null;
    for (const selector of inputSelectors) {
      input = document.querySelector(selector);
      if (input) break;
    }
    
    if (!input) {
      console.warn('🛤️ PromptTrail: Could not find ChatGPT input');
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(prompt.text).then(() => {
        this.showToast('Copied to clipboard!');
      });
      return;
    }
    
    // Handle contenteditable div or textarea
    if (input.tagName === 'TEXTAREA') {
      input.value = prompt.text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Contenteditable div
      input.innerHTML = '';
      input.textContent = prompt.text;
      
      // Trigger input event for React
      input.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        cancelable: true,
        inputType: 'insertText',
        data: prompt.text
      }));
    }
    
    // Focus the input
    input.focus();
    
    // Show visual feedback
    this.showCopyFeedback(promptId);
    console.log('🛤️ PromptTrail: Copied prompt to input', promptId);
  }
  
  showCopyFeedback(promptId) {
    const item = document.querySelector(`[data-prompt-id="${promptId}"]`);
    if (item) {
      const btn = item.querySelector('.pts-copy');
      btn.classList.add('pts-copied');
      setTimeout(() => btn.classList.remove('pts-copied'), 1500);
    }
  }
  
  showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'pts-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('pts-toast-show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('pts-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
  
  toggleBookmarkFilter() {
    this.showOnlyBookmarks = !this.showOnlyBookmarks;
    
    // Update button state
    const btn = this.sidebar.querySelector('.pts-filter-bookmarks');
    btn.classList.toggle('pts-filter-active', this.showOnlyBookmarks);
    
    // Re-render with filter
    this.renderPromptList();
    
    console.log('🛤️ PromptTrail: Bookmark filter', this.showOnlyBookmarks ? 'ON' : 'OFF');
  }

  scrollToPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt || !prompt.element) {
      console.warn('🛤️ PromptTrail: Prompt element not found');
      return;
    }

    // Remove active state from all items
    document.querySelectorAll('.pts-prompt-item').forEach(el => {
      el.classList.remove('pts-active');
    });

    // Add active state to clicked item
    const clickedItem = document.querySelector(`[data-prompt-id="${promptId}"]`);
    if (clickedItem) {
      clickedItem.classList.add('pts-active');
    }

    // Scroll the prompt into view
    prompt.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Add highlight effect
    prompt.element.classList.add('pts-highlight-flash');
    setTimeout(() => {
      prompt.element.classList.remove('pts-highlight-flash');
    }, 2000);

    console.log('🛤️ PromptTrail: Scrolled to prompt', promptId);
  }

  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance
let promptTimeline = null;

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    promptTimeline = new PromptTimeline();
  });
} else {
  promptTimeline = new PromptTimeline();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR' && promptTimeline) {
    promptTimeline.toggle();
    sendResponse({ success: true });
  }
  return true;
});

// Handle SPA navigation (ChatGPT is a single-page app)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('🛤️ PromptTrail: URL changed, reinitializing...');
    
    // Clean up old instance
    if (promptTimeline) {
      if (promptTimeline.observer) {
        promptTimeline.observer.disconnect();
      }
      promptTimeline.prompts = [];
    }
    
    // Reinitialize after a short delay
    setTimeout(() => {
      promptTimeline = new PromptTimeline();
    }, 1000);
  }
}).observe(document.body, { subtree: true, childList: true });
