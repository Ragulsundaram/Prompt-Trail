// Background service worker for Prompt Version Tracking Extension

class PromptVersionTracker {
  constructor() {
    this.init();
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Listen for tab updates to inject content scripts
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
  }

  handleInstalled(details) {
    console.log('Prompt Version Tracker installed:', details.reason);
    
    // Initialize storage if needed
    chrome.storage.local.get(['promptVersions'], (result) => {
      if (!result.promptVersions) {
        chrome.storage.local.set({
          promptVersions: {
            sessions: {},
            versions: {},
            settings: {
              autoSave: true,
              checkpointInterval: 5, // minutes
              maxVersions: 1000
            }
          }
        });
      }
    });
  }

  handleMessage(message, sender, sendResponse) {
    console.log('Background received message:', message);
    
    switch (message.type) {
      case 'SAVE_PROMPT_VERSION':
        this.savePromptVersion(message.data, sendResponse);
        break;
      case 'GET_PROMPT_HISTORY':
        this.getPromptHistory(message.data, sendResponse);
        break;
      case 'CREATE_CHECKPOINT':
        this.createCheckpoint(message.data, sendResponse);
        break;
      case 'EXPORT_DATA':
        this.exportData(sendResponse);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
    
    return true; // Keep message channel open for async response
  }

  handleTabUpdated(tabId, changeInfo, tab) {
    // Check if we're on a supported platform
    if (changeInfo.status === 'complete' && tab.url) {
      const supportedDomains = [
        'chat.openai.com',
        'chatgpt.com',
        'bard.google.com', 
        'claude.ai'
      ];
      
      const isSupported = supportedDomains.some(domain => 
        tab.url.includes(domain)
      );
      
      if (isSupported) {
        console.log('Supported platform detected:', tab.url);
        // Content script will auto-inject based on manifest
      }
    }
  }

  async savePromptVersion(data, sendResponse) {
    try {
      const { sessionId, prompt, response, platform, isCheckpoint } = data;
      
      const result = await chrome.storage.local.get(['promptVersions']);
      const storage = result.promptVersions || { sessions: {}, versions: {} };
      
      // Generate version ID
      const versionId = this.generateId();
      const timestamp = Date.now();
      
      // Create version object
      const version = {
        id: versionId,
        prompt: prompt,
        response: response || null,
        timestamp: timestamp,
        platform: platform,
        sessionId: sessionId,
        isCheckpoint: isCheckpoint || false,
        tags: []
      };
      
      // Store version
      storage.versions[versionId] = version;
      
      // Update session
      if (!storage.sessions[sessionId]) {
        storage.sessions[sessionId] = {
          id: sessionId,
          platform: platform,
          created: timestamp,
          versions: [],
          branches: []
        };
      }
      
      storage.sessions[sessionId].versions.push(versionId);
      storage.sessions[sessionId].lastUpdated = timestamp;
      
      // Save to storage
      await chrome.storage.local.set({ promptVersions: storage });
      
      sendResponse({ success: true, versionId: versionId });
    } catch (error) {
      console.error('Error saving prompt version:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getPromptHistory(data, sendResponse) {
    try {
      const { sessionId, limit = 50 } = data;
      
      const result = await chrome.storage.local.get(['promptVersions']);
      const storage = result.promptVersions || { sessions: {}, versions: {} };
      
      if (!sessionId) {
        // Return all sessions
        const sessions = Object.values(storage.sessions)
          .sort((a, b) => b.lastUpdated - a.lastUpdated)
          .slice(0, limit);
        
        sendResponse({ success: true, data: sessions });
        return;
      }
      
      // Return specific session with versions
      const session = storage.sessions[sessionId];
      if (!session) {
        // Instead of returning an error, return empty session structure
        console.log('Session not found, creating empty session structure for:', sessionId);
        sendResponse({ 
          success: true, 
          data: {
            prompts: [],
            totalCount: 0,
            sessionId: sessionId,
            session: {
              id: sessionId,
              platform: 'unknown',
              created: Date.now(),
              versions: [],
              branches: []
            }
          }
        });
        return;
      }
      
      const versions = session.versions
        .map(versionId => storage.versions[versionId])
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      
      sendResponse({ 
        success: true, 
        data: { 
          session: session, 
          versions: versions 
        } 
      });
    } catch (error) {
      console.error('Error getting prompt history:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async createCheckpoint(data, sendResponse) {
    try {
      const { versionId, name, description } = data;
      
      const result = await chrome.storage.local.get(['promptVersions']);
      const storage = result.promptVersions;
      
      if (!storage.versions[versionId]) {
        sendResponse({ success: false, error: 'Version not found' });
        return;
      }
      
      // Update version to mark as checkpoint
      storage.versions[versionId].isCheckpoint = true;
      storage.versions[versionId].checkpointName = name;
      storage.versions[versionId].checkpointDescription = description;
      
      await chrome.storage.local.set({ promptVersions: storage });
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async exportData(sendResponse) {
    try {
      const result = await chrome.storage.local.get(['promptVersions']);
      const data = result.promptVersions || { sessions: {}, versions: {} };
      
      // Create export object with metadata
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        data: data
      };
      
      sendResponse({ success: true, data: exportData });
    } catch (error) {
      console.error('Error exporting data:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Initialize the tracker
new PromptVersionTracker();
