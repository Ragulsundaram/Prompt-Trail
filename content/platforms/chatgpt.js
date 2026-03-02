// ChatGPT Prompt Timeline - Simple sidebar that shows prompts and scrolls to them

class PromptTimeline {
  constructor() {
    this.prompts = [];
    this.sidebar = null;
    this.observer = null;
    this.isVisible = true;
    
    this.init();
  }

  async init() {
    console.log('🛤️ PromptTrail: Initializing...');
    
    // Wait for the page to load
    await this.waitForConversation();
    
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
          Prompt Trail
          <span class="pts-count" id="pts-count">0</span>
        </div>
        <div class="pts-header-actions">
          <button class="pts-rescan" title="Rescan prompts">↻</button>
          <button class="pts-close" title="Collapse sidebar">»</button>
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
    `;

    // Add styles
    this.addStyles();
    
    // Add to page
    document.body.appendChild(this.sidebar);

    // Setup button handlers
    this.sidebar.querySelector('.pts-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    this.sidebar.querySelector('.pts-rescan').addEventListener('click', (e) => {
      e.stopPropagation();
      this.rescan();
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
        padding: 16px 20px;
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
      
      .pts-close, .pts-rescan {
        background: none;
        border: none;
        color: #8b949e;
        font-size: 16px;
        cursor: pointer;
        padding: 6px 8px;
        border-radius: 6px;
        transition: all 0.15s;
      }

      .pts-close:hover, .pts-rescan:hover {
        color: #c9d1d9;
        background: #21262d;
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
    `;

    document.head.appendChild(styles);
  }

  toggle() {
    const isCollapsed = this.sidebar.classList.contains('pts-collapsed');
    
    if (isCollapsed) {
      // Expand
      this.sidebar.classList.remove('pts-collapsed');
      this.isVisible = true;
    } else {
      // Collapse
      this.sidebar.classList.add('pts-collapsed');
      this.isVisible = false;
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
    // Check if we already have this prompt (by element reference)
    const existing = this.prompts.find(p => p.element === element);
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
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    // Update count badge
    if (countEl) {
      countEl.textContent = this.prompts.length;
    }

    if (this.prompts.length === 0) {
      container.innerHTML = '<div class="pts-empty">No prompts yet.<br><small style="color:#6e7681">Start a conversation!</small></div>';
      return;
    }

    container.innerHTML = this.prompts.map((prompt, idx) => `
      <div class="pts-prompt-item" data-prompt-id="${prompt.id}">
        <div class="pts-prompt-num"><span>${idx + 1}</span></div>
        <div class="pts-prompt-text">${this.escapeHtml(prompt.text)}</div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.pts-prompt-item').forEach((item) => {
      item.addEventListener('click', () => {
        const promptId = item.dataset.promptId;
        this.scrollToPrompt(promptId);
      });
    });
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
