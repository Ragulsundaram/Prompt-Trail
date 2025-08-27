// Sidebar panel script for Prompt Version Tracking Extension

class SidebarPanel {
  constructor() {
    this.currentTab = null;
    this.versions = [];
    this.platform = null;
    
    this.init();
  }

  async init() {
    try {
      await this.getCurrentTab();
      await this.detectPlatform();
      await this.loadVersionHistory();
      this.setupEventListeners();
      
      // Update platform indicator
      this.updatePlatformIndicator();
      
    } catch (error) {
      console.error('Failed to initialize sidebar:', error);
      this.showError('Failed to initialize. Please refresh the page.');
    }
  }

  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tabs[0];
  }

  detectPlatform() {
    if (!this.currentTab || !this.currentTab.url) {
      this.platform = 'unknown';
      return;
    }

    const url = this.currentTab.url;
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      this.platform = 'chatgpt';
    } else if (url.includes('bard.google.com')) {
      this.platform = 'gemini';
    } else if (url.includes('claude.ai')) {
      this.platform = 'claude';
    } else {
      this.platform = 'unknown';
    }
  }

  updatePlatformIndicator() {
    const platformInfo = document.getElementById('platform-info');
    
    const platformNames = {
      'chatgpt': 'ChatGPT',
      'gemini': 'Gemini',
      'claude': 'Claude',
      'unknown': 'Unsupported Platform'
    };

    const platformColors = {
      'chatgpt': '#10a37f',
      'gemini': '#4285f4',
      'claude': '#ff6b35',
      'unknown': '#6c757d'
    };

    const platformName = platformNames[this.platform] || 'Unknown';
    const platformColor = platformColors[this.platform] || '#6c757d';

    platformInfo.innerHTML = `
      <span class="platform-indicator" style="background: ${platformColor}">
        ${platformName}
      </span>
    `;
  }

  async loadVersionHistory() {
    try {
      if (this.platform === 'unknown') {
        this.showUnsupportedPlatform();
        return;
      }

      // Get version history from storage
      const result = await chrome.storage.local.get(['promptVersions']);
      const data = result.promptVersions || { sessions: {}, versions: {} };
      
      // Find sessions for current platform
      const platformSessions = Object.values(data.sessions)
        .filter(session => session.platform === this.platform)
        .sort((a, b) => (b.lastUpdated || b.created) - (a.lastUpdated || a.created));

      // Get all versions from platform sessions
      this.versions = [];
      platformSessions.forEach(session => {
        session.versions.forEach(versionId => {
          if (data.versions[versionId]) {
            this.versions.push(data.versions[versionId]);
          }
        });
      });

      // Sort by timestamp (newest first)
      this.versions.sort((a, b) => b.timestamp - a.timestamp);

      this.renderVersionList();
      
    } catch (error) {
      console.error('Failed to load version history:', error);
      this.showError('Failed to load version history.');
    }
  }

  renderVersionList() {
    const container = document.getElementById('version-container');
    
    if (this.versions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No prompt versions found for ${this.platform}.</p>
          <p>Start typing in the chat interface to begin tracking!</p>
        </div>
      `;
      return;
    }

    const versionItems = this.versions.map(version => this.createVersionElement(version));
    
    container.innerHTML = `
      <div class="version-list">
        ${versionItems.join('')}
      </div>
    `;

    // Add event listeners
    this.addVersionEventListeners();
  }

  createVersionElement(version) {
    const timestamp = this.formatTimestamp(version.timestamp);
    const promptPreview = this.truncateText(version.prompt, 120);
    const typeIcon = version.isCheckpoint ? '📌' : '💬';
    const typeClass = version.isCheckpoint ? 'checkpoint' : '';

    return `
      <div class="version-item">
        <div class="version-header">
          <span class="version-type">${typeIcon}</span>
          <span class="version-time">${timestamp}</span>
        </div>
        <div class="version-preview ${typeClass}">
          ${this.escapeHtml(promptPreview)}
        </div>
        ${version.response ? `
          <div class="version-response" style="background: #e8f5e8; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; border-left: 3px solid #28a745;">
            <strong>Response:</strong> ${this.escapeHtml(this.truncateText(version.response, 100))}
          </div>
        ` : ''}
        <div class="version-actions">
          <button class="btn btn-restore" data-version-id="${version.id}">
            Restore
          </button>
          <button class="btn btn-branch" data-version-id="${version.id}">
            Branch
          </button>
        </div>
      </div>
    `;
  }

  addVersionEventListeners() {
    // Restore buttons
    document.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const versionId = e.target.getAttribute('data-version-id');
        this.restoreVersion(versionId);
      });
    });

    // Branch buttons
    document.querySelectorAll('.btn-branch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const versionId = e.target.getAttribute('data-version-id');
        this.createBranch(versionId);
      });
    });
  }

  async restoreVersion(versionId) {
    try {
      const version = this.versions.find(v => v.id === versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      // Send message to content script to restore the prompt
      await chrome.tabs.sendMessage(this.currentTab.id, {
        type: 'RESTORE_VERSION',
        data: { prompt: version.prompt, versionId: versionId }
      });

      this.showNotification('Prompt restored successfully!');
      
    } catch (error) {
      console.error('Failed to restore version:', error);
      this.showNotification('Failed to restore prompt.', 'error');
    }
  }

  async createBranch(versionId) {
    try {
      const version = this.versions.find(v => v.id === versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      // Send message to content script to create branch
      await chrome.tabs.sendMessage(this.currentTab.id, {
        type: 'CREATE_BRANCH',
        data: { prompt: version.prompt, versionId: versionId }
      });

      this.showNotification('Branch created! You can now modify the prompt.');
      
    } catch (error) {
      console.error('Failed to create branch:', error);
      this.showNotification('Failed to create branch.', 'error');
    }
  }

  setupEventListeners() {
    // Listen for storage changes to update the list
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.promptVersions) {
        this.loadVersionHistory();
      }
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tabId === this.currentTab?.id && changeInfo.url) {
        this.currentTab = tab;
        this.detectPlatform();
        this.updatePlatformIndicator();
        this.loadVersionHistory();
      }
    });
  }

  showUnsupportedPlatform() {
    const container = document.getElementById('version-container');
    container.innerHTML = `
      <div class="empty-state">
        <h3>Unsupported Platform</h3>
        <p>Prompt version tracking is currently supported on:</p>
        <ul style="text-align: left; display: inline-block;">
          <li>ChatGPT (chat.openai.com)</li>
          <li>Gemini (bard.google.com) - Coming Soon</li>
          <li>Claude (claude.ai) - Coming Soon</li>
        </ul>
        <p>Please navigate to one of these platforms to use the extension.</p>
      </div>
    `;
  }

  showError(message) {
    const container = document.getElementById('version-container');
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }

  showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : '#dc3545'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      font-size: 14px;
      max-width: 300px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 1 day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // More than 1 day
    const days = Math.floor(diff / 86400000);
    if (days < 7) {
      return `${days}d ago`;
    }

    // More than 1 week - show date
    return date.toLocaleDateString();
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SidebarPanel();
});
