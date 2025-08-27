// Storage management for Prompt Version Tracking

class PromptStorage {
  constructor() {
    this.cache = new Map();
    this.init();
  }

  async init() {
    try {
      const result = await chrome.storage.local.get(['promptVersions']);
      if (result.promptVersions) {
        this.cache.set('promptVersions', result.promptVersions);
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to initialize storage:', error);
    }
  }

  // Save a new prompt version
  async saveVersion(promptData) {
    try {
      const response = await PromptUtils.sendMessage({
        type: 'SAVE_PROMPT_VERSION',
        data: promptData
      });

      if (response.success) {
        PromptUtils.log('info', 'Prompt version saved:', response.versionId);
        return response.versionId;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to save prompt version:', error);
      throw error;
    }
  }

  // Get prompt history for a session
  async getHistory(sessionId = null, limit = 50) {
    try {
      const response = await PromptUtils.sendMessage({
        type: 'GET_PROMPT_HISTORY',
        data: { sessionId, limit }
      });

      if (response.success) {
        return response.data;
      } else {
        // If session not found, return empty history instead of throwing
        if (response.error && response.error.includes('Session not found')) {
          PromptUtils.log('info', 'No existing session found, returning empty history');
          return {
            prompts: [],
            totalCount: 0,
            sessionId: sessionId
          };
        }
        throw new Error(response.error);
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to get prompt history:', error);
      // Return empty history instead of throwing for better UX
      return {
        prompts: [],
        totalCount: 0,
        sessionId: sessionId
      };
    }
  }

  // Create a checkpoint for a version
  async createCheckpoint(versionId, name, description = '') {
    try {
      const response = await PromptUtils.sendMessage({
        type: 'CREATE_CHECKPOINT',
        data: { versionId, name, description }
      });

      if (response.success) {
        PromptUtils.log('info', 'Checkpoint created for version:', versionId);
        return true;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to create checkpoint:', error);
      throw error;
    }
  }

  // Export all data
  async exportData() {
    try {
      const response = await PromptUtils.sendMessage({
        type: 'EXPORT_DATA'
      });

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      PromptUtils.log('error', 'Failed to export data:', error);
      throw error;
    }
  }

  // Import data (validation and storage)
  async importData(importData) {
    try {
      // Validate import data structure
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data format');
      }

      // Get current data
      const currentData = await this.exportData();
      
      // Merge data (simple approach - can be enhanced)
      const mergedData = this.mergeData(currentData.data, importData.data);
      
      // Save merged data
      await chrome.storage.local.set({ promptVersions: mergedData });
      
      PromptUtils.log('info', 'Data imported successfully');
      return true;
    } catch (error) {
      PromptUtils.log('error', 'Failed to import data:', error);
      throw error;
    }
  }

  // Validate import data structure
  validateImportData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.data || typeof data.data !== 'object') return false;
    if (!data.data.sessions || typeof data.data.sessions !== 'object') return false;
    if (!data.data.versions || typeof data.data.versions !== 'object') return false;
    
    return true;
  }

  // Merge imported data with existing data
  mergeData(currentData, importData) {
    const merged = {
      sessions: { ...currentData.sessions },
      versions: { ...currentData.versions },
      settings: { ...currentData.settings, ...importData.settings }
    };

    // Merge sessions (avoid ID conflicts)
    Object.entries(importData.sessions).forEach(([sessionId, session]) => {
      if (merged.sessions[sessionId]) {
        // Handle conflict - rename imported session
        const newSessionId = sessionId + '_imported_' + Date.now();
        merged.sessions[newSessionId] = { ...session, id: newSessionId };
        
        // Update version references
        session.versions.forEach(versionId => {
          if (importData.versions[versionId]) {
            importData.versions[versionId].sessionId = newSessionId;
          }
        });
      } else {
        merged.sessions[sessionId] = session;
      }
    });

    // Merge versions (avoid ID conflicts)
    Object.entries(importData.versions).forEach(([versionId, version]) => {
      if (merged.versions[versionId]) {
        // Handle conflict - rename imported version
        const newVersionId = versionId + '_imported_' + Date.now();
        merged.versions[newVersionId] = { ...version, id: newVersionId };
        
        // Update session references
        const sessionId = version.sessionId;
        if (merged.sessions[sessionId]) {
          const versionIndex = merged.sessions[sessionId].versions.indexOf(versionId);
          if (versionIndex !== -1) {
            merged.sessions[sessionId].versions[versionIndex] = newVersionId;
          }
        }
      } else {
        merged.versions[versionId] = version;
      }
    });

    return merged;
  }

  // Clear all data (with confirmation)
  async clearAllData() {
    try {
      await chrome.storage.local.remove(['promptVersions']);
      this.cache.clear();
      PromptUtils.log('info', 'All data cleared');
      return true;
    } catch (error) {
      PromptUtils.log('error', 'Failed to clear data:', error);
      throw error;
    }
  }

  // Get storage usage statistics
  async getStorageStats() {
    try {
      const usage = await chrome.storage.local.getBytesInUse(['promptVersions']);
      const result = await chrome.storage.local.get(['promptVersions']);
      const data = result.promptVersions || { sessions: {}, versions: {} };
      
      return {
        bytesUsed: usage,
        sessionCount: Object.keys(data.sessions).length,
        versionCount: Object.keys(data.versions).length,
        checkpointCount: Object.values(data.versions).filter(v => v.isCheckpoint).length
      };
    } catch (error) {
      PromptUtils.log('error', 'Failed to get storage stats:', error);
      throw error;
    }
  }

  // Search through prompt history
  async searchPrompts(query, options = {}) {
    try {
      const { sessionId = null, includeResponses = false, limit = 100 } = options;
      const historyData = await this.getHistory(sessionId, limit);
      
      const versions = sessionId ? historyData.versions : 
        Object.values(historyData).flatMap(session => session.versions || []);
      
      const results = versions.filter(version => {
        if (!version) return false;
        
        const searchText = includeResponses ? 
          `${version.prompt} ${version.response || ''}` : 
          version.prompt;
        
        return searchText.toLowerCase().includes(query.toLowerCase());
      });
      
      return results.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      PromptUtils.log('error', 'Failed to search prompts:', error);
      throw error;
    }
  }
}

// Make available globally
window.PromptStorage = PromptStorage;
