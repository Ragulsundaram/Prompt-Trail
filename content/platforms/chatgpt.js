// ChatGPT platform adapter for Prompt Version Tracking

class ChatGPTAdapter {
  constructor() {
    this.versionManager = null;
    this.textArea = null;
    this.submitButton = null;
    this.conversationContainer = null;
    this.lastSubmittedPrompt = '';
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    try {
      PromptUtils.log('info', 'Initializing ChatGPT adapter');
      
      // Wait for page to load
      await this.waitForPageLoad();
      
      // Initialize version manager
      this.versionManager = new PromptVersionManager('chatgpt');
      
      // Find UI elements
      await this.findUIElements();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize sidebar
      this.initializeSidebar();
      
      // Add debug panel for testing
      this.addDebugPanel();
      
      this.isInitialized = true;
      PromptUtils.log('info', 'ChatGPT adapter initialized successfully');
      
      // Test message to confirm initialization
      console.log('�️ PromptTrail Ready for ChatGPT!', {
        textArea: !!this.textArea,
        submitButton: !!this.submitButton,
        versionManager: !!this.versionManager
      });
      
    } catch (error) {
      PromptUtils.log('error', 'Failed to initialize ChatGPT adapter:', error);
    }
  }

  async waitForPageLoad() {
    // Wait for the main chat interface to load
    return PromptUtils.waitForElement('main', 10000);
  }

  async findUIElements() {
    try {
      // ChatGPT text input area (updated selectors for current interface)
      const textAreaSelectors = [
        'textarea[data-id="root"]',
        'textarea[placeholder*="Message ChatGPT"]',
        'textarea[placeholder*="message"]',
        'textarea[placeholder*="ChatGPT"]',
        'textarea[placeholder*="Message"]',
        '#prompt-textarea',
        'div[contenteditable="true"]', // New ChatGPT uses contenteditable
        'textarea',
        'div[role="textbox"]'
      ];

      for (const selector of textAreaSelectors) {
        this.textArea = document.querySelector(selector);
        if (this.textArea) {
          PromptUtils.log('info', 'Found text area with selector:', selector);
          break;
        }
      }

      if (!this.textArea) {
        throw new Error('Could not find ChatGPT text input area');
      }

      // Submit button
      const submitSelectors = [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="submit"]',
        'button[type="submit"]',
        'button:has(svg)',
        '[data-testid="fruitjuice-send-button"]' // New ChatGPT send button
      ];

      for (const selector of submitSelectors) {
        this.submitButton = document.querySelector(selector);
        if (this.submitButton) {
          PromptUtils.log('info', 'Found submit button with selector:', selector);
          break;
        }
      }

      // Conversation container
      const containerSelectors = [
        '[role="main"]',
        '.conversation',
        '[data-testid="conversation"]',
        'main'
      ];

      for (const selector of containerSelectors) {
        this.conversationContainer = document.querySelector(selector);
        if (this.conversationContainer) {
          PromptUtils.log('info', 'Found conversation container with selector:', selector);
          break;
        }
      }

    } catch (error) {
      PromptUtils.log('error', 'Failed to find UI elements:', error);
      throw error;
    }
  }

  setupEventListeners() {
    if (!this.textArea) return;

    // Text change detection with debouncing
    const debouncedTextChange = PromptUtils.debounce(() => {
      const currentText = this.getCurrentText();
      this.handleTextChange(currentText);
    }, 1000);

    // Handle both input and contenteditable changes
    this.textArea.addEventListener('input', () => {
      debouncedTextChange();
    });

    this.textArea.addEventListener('paste', () => {
      setTimeout(() => {
        debouncedTextChange();
      }, 100);
    });

    // For contenteditable elements
    this.textArea.addEventListener('DOMCharacterDataModified', () => {
      debouncedTextChange();
    });

    // Submit detection
    if (this.submitButton) {
      this.submitButton.addEventListener('click', () => {
        this.handleSubmit();
      });
    }

    // Enter key detection
    this.textArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        setTimeout(() => {
          this.handleSubmit();
        }, 100);
      }
    });

    // Manual checkpoint hotkey (Ctrl+S)
    this.textArea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.createQuickCheckpoint();
      }
    });

    // Response detection using mutation observer
    this.setupResponseDetection();

    // Version restore listener
    window.addEventListener('promptVersionRestore', (e) => {
      this.restorePromptToTextArea(e.detail.version.prompt);
    });

    // Message listener for popup commands
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });

    PromptUtils.log('info', 'Event listeners set up for ChatGPT');
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'TOGGLE_SIDEBAR':
        this.toggleSidebar();
        sendResponse({ success: true });
        break;
        
      case 'CREATE_CHECKPOINT':
        this.createManualCheckpoint()
          .then(success => sendResponse({ success }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        break;
        
      case 'RESTORE_VERSION':
        this.restorePromptToTextArea(message.data.prompt);
        sendResponse({ success: true });
        break;
        
      case 'CREATE_BRANCH':
        this.createBranchFromPrompt(message.data.prompt, message.data.versionId)
          .then(success => sendResponse({ success }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  toggleSidebar() {
    console.log('🔄 Toggle sidebar called');
    
    const sidebar = document.getElementById('prompt-version-sidebar');
    if (sidebar) {
      const isVisible = sidebar.style.display !== 'none';
      sidebar.style.display = isVisible ? 'none' : 'block';
      
      console.log('📱 Sidebar toggled:', isVisible ? 'hidden' : 'shown');
      
      if (!isVisible) {
        // Refresh version list when showing
        const sidebarInstance = window.promptVersionSidebar;
        if (sidebarInstance) {
          sidebarInstance.refreshVersionList();
        }
      }
    } else {
      console.error('❌ Sidebar element not found!');
      // Try to create sidebar if it doesn't exist
      this.initializeSidebar();
    }
  }

  async createBranchFromPrompt(prompt, versionId) {
    try {
      // Restore the prompt first
      this.restorePromptToTextArea(prompt);
      
      // Create a branch in the version manager
      await this.versionManager.createBranch(versionId, prompt);
      
      this.showNotification('🌿 Branch created! Start editing.');
      return true;
    } catch (error) {
      this.showNotification('✗ Failed to create branch');
      throw error;
    }
  }

  async createQuickCheckpoint() {
    if (!this.textArea) return;
    
    const currentText = this.textArea.value.trim();
    if (!currentText) return;

    const checkpointName = prompt('Name this checkpoint (optional):') || 
                          `Quick Save ${new Date().toLocaleTimeString()}`;
    
    try {
      await this.versionManager.createCheckpoint(
        currentText,
        null,
        checkpointName,
        'User-created checkpoint via Ctrl+S'
      );
      
      this.showNotification('✓ Checkpoint saved!');
      PromptUtils.log('info', 'Quick checkpoint created:', checkpointName);
    } catch (error) {
      this.showNotification('✗ Failed to save checkpoint');
      PromptUtils.log('error', 'Failed to create quick checkpoint:', error);
    }
  }

  showNotification(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(40, 167, 69, 0.3);
      z-index: 10001;
      font-family: system-ui;
      font-size: 14px;
      animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }

  setupResponseDetection() {
    if (!this.conversationContainer) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewResponse(node);
            }
          });
        }
      });
    });

    observer.observe(this.conversationContainer, {
      childList: true,
      subtree: true
    });

    PromptUtils.log('info', 'Response detection set up');
  }

  checkForNewResponse(element) {
    // Look for ChatGPT response indicators
    const responseIndicators = [
      '[data-message-author-role="assistant"]',
      '.markdown',
      '[class*="response"]',
      '[class*="assistant"]'
    ];

    for (const selector of responseIndicators) {
      const responseElement = element.querySelector ? 
        element.querySelector(selector) : 
        (element.matches && element.matches(selector) ? element : null);

      if (responseElement) {
        setTimeout(() => {
          this.handleNewResponse(responseElement);
        }, 1000); // Wait for response to fully load
        break;
      }
    }
  }

  async handleTextChange(text) {
    if (!this.versionManager || !text || !text.trim()) return;

    try {
      // Enhanced tracking for different prompting patterns
      const previousText = this.versionManager.lastPrompt || '';
      
      // Pattern detection
      const changeType = this.detectChangePattern(previousText, text);
      
      // Only save significant changes to avoid spam
      if (changeType !== 'minor_edit') {
        await this.versionManager.savePromptVersion(text, null, false, changeType);
        
        // Log the detected pattern for debugging
        PromptUtils.log('info', `Change detected: ${changeType}`, {
          similarity: PromptUtils.calculateSimilarity(previousText, text),
          lengthDiff: text.length - previousText.length
        });
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to save prompt version on text change:', error);
    }
  }

  getCurrentText() {
    if (!this.textArea) return '';
    
    // Handle different types of input elements
    if (this.textArea.value !== undefined) {
      // Standard textarea or input
      return this.textArea.value;
    } else if (this.textArea.textContent !== undefined) {
      // Contenteditable div
      return this.textArea.textContent;
    } else if (this.textArea.innerText !== undefined) {
      // Fallback to innerText
      return this.textArea.innerText;
    }
    
    return '';
  }

  detectChangePattern(oldText, newText) {
    if (!oldText) return 'new_prompt';
    
    const similarity = PromptUtils.calculateSimilarity(oldText, newText);
    const lengthDiff = Math.abs(newText.length - oldText.length);
    const lengthRatio = newText.length / oldText.length;
    
    // Pattern: Copy-paste with edits
    if (similarity > 0.8 && lengthDiff > 20) {
      return 'copy_paste_edit';
    }
    
    // Pattern: Major rewrite/new prompt
    if (similarity < 0.3) {
      return 'major_rewrite';
    }
    
    // Pattern: Adding detail (significant length increase)
    if (similarity > 0.7 && lengthRatio > 1.3) {
      return 'detail_addition';
    }
    
    // Pattern: Refinement (moderate changes)
    if (similarity > 0.6 && similarity < 0.8) {
      return 'refinement';
    }
    
    // Pattern: Minor edit (don't save)
    if (similarity > 0.9 && lengthDiff < 10) {
      return 'minor_edit';
    }
    
    return 'general_edit';
  }

  async handleSubmit() {
    if (!this.versionManager || !this.textArea) return;

    const currentText = this.getCurrentText();
    if (!currentText || !currentText.trim()) return;

    try {
      // Save as checkpoint when submitted
      this.lastSubmittedPrompt = currentText;
      await this.versionManager.createCheckpoint(
        currentText,
        null,
        'Submitted Prompt',
        'User submitted this prompt'
      );

      PromptUtils.log('info', 'Prompt submitted and saved as checkpoint');
    } catch (error) {
      PromptUtils.log('error', 'Failed to save submitted prompt:', error);
    }
  }

  async handleNewResponse(responseElement) {
    if (!this.versionManager || !this.lastSubmittedPrompt) return;

    try {
      const responseText = this.extractResponseText(responseElement);
      if (responseText) {
        // Update the last submitted prompt with the response
        await this.versionManager.savePromptVersion(
          this.lastSubmittedPrompt,
          responseText,
          true
        );

        PromptUtils.log('info', 'Response captured and associated with prompt');
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to capture response:', error);
    }
  }

  extractResponseText(element) {
    // Try to extract clean text from response element
    const textContent = element.textContent || element.innerText || '';
    return PromptUtils.normalizePrompt(textContent);
  }

  restorePromptToTextArea(prompt) {
    if (!this.textArea) return;

    // Set the value
    this.textArea.value = prompt;

    // Trigger change events to notify React/other frameworks
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    
    this.textArea.dispatchEvent(inputEvent);
    this.textArea.dispatchEvent(changeEvent);

    // Focus the text area
    this.textArea.focus();

    PromptUtils.log('info', 'Prompt restored to text area');
  }

  initializeSidebar() {
    // Initialize the version tracking sidebar
    try {
      const sidebar = new PromptVersionSidebar(this.versionManager);
      window.promptVersionSidebar = sidebar; // Make globally accessible
      PromptUtils.log('info', 'Sidebar initialized for ChatGPT');
    } catch (error) {
      PromptUtils.log('error', 'Failed to initialize sidebar:', error);
    }
  }

  // Manual checkpoint creation
  async createManualCheckpoint(name = '', description = '') {
    if (!this.versionManager || !this.textArea) return;

    const currentText = this.textArea.value.trim();
    if (!currentText) return;

    try {
      await this.versionManager.createCheckpoint(
        currentText,
        null,
        name || `Manual Checkpoint ${new Date().toLocaleTimeString()}`,
        description
      );

      PromptUtils.log('info', 'Manual checkpoint created');
      return true;
    } catch (error) {
      PromptUtils.log('error', 'Failed to create manual checkpoint:', error);
      return false;
    }
  }

  // Get current prompt text
  getCurrentPrompt() {
    return this.textArea ? this.textArea.value : '';
  }

  // Check if adapter is ready
  isReady() {
    return this.isInitialized && this.textArea && this.versionManager;
  }

  addDebugPanel() {
    // Add a debug panel at the top of the page for testing
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-bottom: 1px solid rgba(255,255,255,0.2);
    `;
    
    debugPanel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-weight: 600;">🛤️ PromptTrail Debug Mode</span>
        <span style="opacity: 0.8;">Platform: ChatGPT | Status: Active</span>
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="debugToggleSidebar" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 6px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          🔄 Toggle Sidebar
        </button>
        <button id="debugCreateSidebar" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 6px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          ➕ Force Create
        </button>
      </div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Add click handlers for debug buttons
    document.getElementById('debugToggleSidebar').addEventListener('click', () => {
      console.log('🔧 Debug toggle clicked!');
      if (this.sidebar) {
        this.sidebar.toggle();
      }
    });
    
    document.getElementById('debugCreateSidebar').addEventListener('click', () => {
      console.log('🔧 Debug force create clicked!');
      if (this.sidebar) {
        this.sidebar.createSidebar();
      }
    });
    
    console.log('🔧 PromptTrail debug panel added with interactive controls');
  }
}

// Simple sidebar implementation for version history
class PromptVersionSidebar {
  constructor(versionManager) {
    this.versionManager = versionManager;
    this.isVisible = false;
    this.container = null;
    
    this.createSidebar();
    this.setupEventListeners();
  }

  createSidebar() {
    // Check if sidebar already exists
    if (document.getElementById('prompt-version-sidebar')) {
      console.log('📱 Sidebar already exists');
      return;
    }

    console.log('🔨 Creating sidebar...');
    
    // Create sidebar container
    this.container = PromptUtils.createElement('div', {
      id: 'prompt-version-sidebar',
      className: 'prompt-version-sidebar',
      style: 'display: none; position: fixed; top: 0; right: 0; width: 320px; height: 100vh; z-index: 10000;'
    });

    // Create header
    const header = PromptUtils.createElement('div', {
      className: 'pvs-header'
    });

    const title = PromptUtils.createElement('h3', {}, 'Prompt Versions');
    const toggleBtn = PromptUtils.createElement('button', {
      className: 'pvs-toggle',
      innerHTML: '×'
    });

    header.appendChild(title);
    header.appendChild(toggleBtn);

    // Create content area
    const content = PromptUtils.createElement('div', {
      className: 'pvs-content',
      id: 'pvs-content'
    });

    content.innerHTML = '<p class="pvs-empty">Loading versions...</p>';

    this.container.appendChild(header);
    this.container.appendChild(content);

    // Add to page body (ensure it's added to the correct document)
    document.body.appendChild(this.container);

    // Set up toggle functionality
    toggleBtn.addEventListener('click', () => {
      this.toggle();
    });

    console.log('✅ Sidebar created and added to DOM');
    PromptUtils.log('info', 'Sidebar created');
  }

  setupEventListeners() {
    // Listen for version updates
    window.addEventListener('promptVersionUpdate', () => {
      this.refreshVersionList();
    });

    // Keyboard shortcut to toggle sidebar (Ctrl+Shift+V)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        console.log('⌨️ Keyboard shortcut triggered');
        this.toggle();
      }
    });

    // Global click handler for testing
    window.addEventListener('click', (e) => {
      if (e.target.closest('.pvs-toggle')) {
        console.log('🖱️ Toggle button clicked');
      }
    });

    console.log('🎧 Sidebar event listeners set up');
  }

  async refreshVersionList() {
    const content = document.getElementById('pvs-content');
    if (!content) return;

    try {
      const versions = await this.versionManager.getSessionHistory(20);
      
      content.innerHTML = '';

      if (versions.length === 0) {
        content.innerHTML = '<p class="pvs-empty">No versions yet</p>';
        return;
      }

      versions.forEach((version, index) => {
        const versionElement = this.createVersionElement(version, index);
        content.appendChild(versionElement);
      });

    } catch (error) {
      PromptUtils.log('error', 'Failed to refresh version list:', error);
      content.innerHTML = '<p class="pvs-error">Failed to load versions</p>';
    }
  }

  createVersionElement(version, index) {
    const element = PromptUtils.createElement('div', {
      className: `pvs-version ${version.isCheckpoint ? 'checkpoint' : 'auto'}`
    });

    const timestamp = PromptUtils.formatTimestamp(version.timestamp);
    const promptPreview = PromptUtils.truncateText(version.prompt, 60);
    
    // Enhanced type indicators
    const getTypeInfo = (version) => {
      if (version.isCheckpoint) {
        return { icon: '📌', label: 'Checkpoint', color: '#28a745' };
      }
      
      const changeTypeIcons = {
        'copy_paste_edit': { icon: '✂️', label: 'Copy+Edit', color: '#17a2b8' },
        'major_rewrite': { icon: '🔄', label: 'Rewrite', color: '#dc3545' },
        'detail_addition': { icon: '➕', label: 'Added Detail', color: '#fd7e14' },
        'refinement': { icon: '✨', label: 'Refined', color: '#6f42c1' },
        'new_prompt': { icon: '🆕', label: 'New', color: '#007bff' },
        'general_edit': { icon: '✏️', label: 'Edit', color: '#6c757d' }
      };
      
      return changeTypeIcons[version.changeType] || 
             { icon: '💬', label: 'Auto', color: '#6c757d' };
    };

    const typeInfo = getTypeInfo(version);

    element.innerHTML = `
      <div class="pvs-version-header">
        <div class="pvs-version-type-info">
          <span class="pvs-version-icon" style="color: ${typeInfo.color}">${typeInfo.icon}</span>
          <span class="pvs-version-label" style="color: ${typeInfo.color}">${typeInfo.label}</span>
        </div>
        <span class="pvs-version-time">${timestamp}</span>
      </div>
      <div class="pvs-version-preview">${promptPreview}</div>
      ${version.checkpointName ? `
        <div class="pvs-checkpoint-name">📝 ${version.checkpointName}</div>
      ` : ''}
      <div class="pvs-version-actions">
        <button class="pvs-restore" data-version-id="${version.id}">Restore</button>
        <button class="pvs-branch" data-version-id="${version.id}">Branch</button>
        ${!version.isCheckpoint ? `
          <button class="pvs-promote" data-version-id="${version.id}">Pin</button>
        ` : ''}
      </div>
    `;

    // Add event listeners
    const restoreBtn = element.querySelector('.pvs-restore');
    const branchBtn = element.querySelector('.pvs-branch');
    const promoteBtn = element.querySelector('.pvs-promote');

    restoreBtn.addEventListener('click', () => {
      this.versionManager.restoreVersion(version.id);
    });

    branchBtn.addEventListener('click', () => {
      this.createBranchFromVersion(version.id);
    });

    if (promoteBtn) {
      promoteBtn.addEventListener('click', () => {
        this.promoteToCheckpoint(version.id);
      });
    }

    return element;
  }

  async promoteToCheckpoint(versionId) {
    const checkpointName = prompt('Name this checkpoint:') || 
                          `Promoted ${new Date().toLocaleTimeString()}`;
    
    try {
      await this.versionManager.storage.createCheckpoint(
        versionId, 
        checkpointName, 
        'Promoted from auto-save'
      );
      this.refreshVersionList();
      this.showNotification('✓ Promoted to checkpoint!');
    } catch (error) {
      this.showNotification('✗ Failed to promote');
      PromptUtils.log('error', 'Failed to promote version:', error);
    }
  }

  showNotification(message) {
    // Create notification in sidebar context
    const notification = document.createElement('div');
    notification.className = 'pvs-notification';
    notification.textContent = message;
    
    this.container.appendChild(notification);
    
    setTimeout(() => {
      if (this.container.contains(notification)) {
        this.container.removeChild(notification);
      }
    }, 3000);
  }

  async createBranchFromVersion(versionId) {
    try {
      const branchInfo = await this.versionManager.createBranch(versionId, '');
      PromptUtils.log('info', 'Branch created from version:', versionId);
      this.refreshVersionList();
    } catch (error) {
      PromptUtils.log('error', 'Failed to create branch:', error);
    }
  }

  toggle() {
    console.log('🔄 Sidebar toggle called');
    
    if (!this.container) {
      console.error('❌ Sidebar container not found');
      return;
    }
    
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? 'block' : 'none';
    
    console.log('📱 Sidebar:', this.isVisible ? 'shown' : 'hidden');
    
    if (this.isVisible) {
      this.refreshVersionList();
    }
  }

  show() {
    console.log('👀 Showing sidebar');
    if (!this.container) {
      console.error('❌ Cannot show sidebar - container not found');
      return;
    }
    
    this.isVisible = true;
    this.container.style.display = 'block';
    this.refreshVersionList();
  }

  hide() {
    console.log('🙈 Hiding sidebar');
    if (!this.container) return;
    
    this.isVisible = false;
    this.container.style.display = 'none';
  }
}

// Initialize the ChatGPT adapter when the script loads
let chatGPTAdapter = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    chatGPTAdapter = new ChatGPTAdapter();
  });
} else {
  chatGPTAdapter = new ChatGPTAdapter();
}

PromptUtils.log('info', 'ChatGPT adapter script loaded');
