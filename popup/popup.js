// Popup script for Prompt Version Tracking Extension

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.updateStatus();
    await this.loadStats();
  }

  setupEventListeners() {
    // Toggle sidebar
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Create checkpoint
    document.getElementById('create-checkpoint').addEventListener('click', () => {
      this.createCheckpoint();
    });

    // Export data
    document.getElementById('export-data').addEventListener('click', () => {
      this.exportData();
    });

    // View stats
    document.getElementById('view-stats').addEventListener('click', () => {
      this.toggleStats();
    });
  }

  async updateStatus() {
    try {
      // Check if we're on a supported platform
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url) {
        if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) {
          document.getElementById('chatgpt-status').className = 'status-indicator active';
        } else {
          document.getElementById('chatgpt-status').className = 'status-indicator inactive';
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get(['promptVersions']);
      const data = result.promptVersions || { sessions: {}, versions: {} };
      
      const totalVersions = Object.keys(data.versions).length;
      const totalCheckpoints = Object.values(data.versions).filter(v => v.isCheckpoint).length;
      
      // Get current session stats
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let sessionVersions = 0;
      
      if (tab && tab.url) {
        // Find current session based on URL/platform
        const currentSessions = Object.values(data.sessions).filter(session => {
          if (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com')) return session.platform === 'chatgpt';
          if (tab.url.includes('bard.google.com')) return session.platform === 'gemini';
          if (tab.url.includes('claude.ai')) return session.platform === 'claude';
          return false;
        });
        
        if (currentSessions.length > 0) {
          // Get the most recent session
          const latestSession = currentSessions.sort((a, b) => b.lastUpdated - a.lastUpdated)[0];
          sessionVersions = latestSession.versions.length;
        }
      }
      
      document.getElementById('total-versions').textContent = totalVersions;
      document.getElementById('total-checkpoints').textContent = totalCheckpoints;
      document.getElementById('session-versions').textContent = sessionVersions;
      
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async toggleSidebar() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !this.isSupportedPlatform(tab.url)) {
        this.showNotification('Please navigate to ChatGPT, Gemini, or Claude first');
        return;
      }

      // Send message to content script to toggle sidebar
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_SIDEBAR'
      });
      
      window.close();
    } catch (error) {
      console.error('Failed to toggle sidebar:', error);
      this.showNotification('Failed to toggle sidebar');
    }
  }

  async createCheckpoint() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !this.isSupportedPlatform(tab.url)) {
        this.showNotification('Please navigate to ChatGPT, Gemini, or Claude first');
        return;
      }

      // Send message to content script to create checkpoint
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CREATE_CHECKPOINT'
      });
      
      if (response && response.success) {
        this.showNotification('Checkpoint created successfully!');
        await this.loadStats();
      } else {
        this.showNotification('Failed to create checkpoint');
      }
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      this.showNotification('Failed to create checkpoint');
    }
  }

  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA'
      });
      
      if (response && response.success) {
        // Create and download file
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `prompt-versions-${timestamp}.json`;
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully!');
      } else {
        this.showNotification('Failed to export data');
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      this.showNotification('Failed to export data');
    }
  }

  toggleStats() {
    const statsSection = document.getElementById('stats-section');
    const isVisible = statsSection.style.display !== 'none';
    
    statsSection.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      this.loadStats();
    }
  }

  isSupportedPlatform(url) {
    if (!url) return false;
    return url.includes('chat.openai.com') || 
           url.includes('chatgpt.com') ||
           url.includes('bard.google.com') || 
           url.includes('claude.ai');
  }

  showNotification(message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
