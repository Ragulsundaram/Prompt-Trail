// Version management system for Prompt Version Tracking

class PromptVersionManager {
  constructor(platform) {
    this.platform = platform;
    this.storage = new PromptStorage();
    this.currentSessionId = null;
    this.lastPrompt = '';
    this.lastResponse = '';
    this.isTracking = false;
    this.autoSaveEnabled = true;
    this.changeThreshold = 0.1; // Minimum change to trigger auto-save
    
    this.init();
  }

  async init() {
    try {
      // Generate or retrieve session ID
      this.currentSessionId = this.generateSessionId();
      
      // Initialize tracking
      this.isTracking = true;
      
      PromptUtils.log('info', 'Version manager initialized', {
        platform: this.platform,
        sessionId: this.currentSessionId
      });
      
      // Set up auto-save interval for checkpoints
      this.setupAutoCheckpoints();
      
    } catch (error) {
      PromptUtils.log('error', 'Failed to initialize version manager:', error);
    }
  }

  generateSessionId() {
    return PromptUtils.generateSessionId(this.platform);
  }

  // Start tracking prompt changes
  startTracking() {
    this.isTracking = true;
    PromptUtils.log('info', 'Prompt tracking started');
  }

  // Stop tracking prompt changes
  stopTracking() {
    this.isTracking = false;
    PromptUtils.log('info', 'Prompt tracking stopped');
  }

  // Save a new prompt version
  async savePromptVersion(prompt, response = null, isCheckpoint = false, changeType = 'general') {
    if (!this.isTracking) return null;

    try {
      // Normalize prompt text
      const normalizedPrompt = PromptUtils.normalizePrompt(prompt);
      
      // Check if this is a significant change (unless it's a manual checkpoint)
      if (!isCheckpoint && !this.isSignificantChange(normalizedPrompt, changeType)) {
        PromptUtils.log('debug', 'Skipping insignificant change');
        return null;
      }

      const versionData = {
        sessionId: this.currentSessionId,
        prompt: normalizedPrompt,
        response: response,
        platform: this.platform,
        isCheckpoint: isCheckpoint,
        changeType: changeType,
        timestamp: Date.now()
      };

      const versionId = await this.storage.saveVersion(versionData);
      
      // Update tracking state
      this.lastPrompt = normalizedPrompt;
      if (response) {
        this.lastResponse = response;
      }

      PromptUtils.log('info', 'Prompt version saved', {
        versionId,
        isCheckpoint,
        changeType,
        promptLength: normalizedPrompt.length
      });

      // Trigger UI update event
      this.triggerUIUpdate();

      return versionId;
    } catch (error) {
      PromptUtils.log('error', 'Failed to save prompt version:', error);
      throw error;
    }
  }

  // Enhanced significance check considering change patterns
  isSignificantChange(newPrompt, changeType) {
    if (!this.lastPrompt) return true;
    
    // Different thresholds for different change types
    const thresholds = {
      'copy_paste_edit': 0.05,    // Even small edits after copy-paste are significant
      'major_rewrite': 0.0,       // Always save major rewrites
      'detail_addition': 0.1,     // Save when adding significant detail
      'refinement': 0.15,         // Medium threshold for refinements
      'minor_edit': 0.3,          // High threshold for minor edits
      'general_edit': 0.1         // Default threshold
    };
    
    const threshold = thresholds[changeType] || this.changeThreshold;
    
    return PromptUtils.isSignificantChange(
      this.lastPrompt, 
      newPrompt, 
      threshold
    );
  }

  // Create a manual checkpoint
  async createCheckpoint(prompt, response = null, name = '', description = '') {
    try {
      const versionId = await this.savePromptVersion(prompt, response, true);
      
      if (versionId && name) {
        await this.storage.createCheckpoint(versionId, name, description);
      }
      
      PromptUtils.log('info', 'Manual checkpoint created', { name, versionId });
      return versionId;
    } catch (error) {
      PromptUtils.log('error', 'Failed to create checkpoint:', error);
      throw error;
    }
  }

  // Get version history for current session
  async getSessionHistory(limit = 50) {
    try {
      const historyData = await this.storage.getHistory(this.currentSessionId, limit);
      return historyData.versions || [];
    } catch (error) {
      PromptUtils.log('error', 'Failed to get session history:', error);
      return [];
    }
  }

  // Get all sessions history
  async getAllSessions(limit = 20) {
    try {
      const sessions = await this.storage.getHistory(null, limit);
      return Array.isArray(sessions) ? sessions : [];
    } catch (error) {
      PromptUtils.log('error', 'Failed to get all sessions:', error);
      return [];
    }
  }

  // Restore a prompt from version history
  async restoreVersion(versionId) {
    try {
      const history = await this.getSessionHistory();
      const version = history.find(v => v.id === versionId);
      
      if (!version) {
        throw new Error('Version not found');
      }

      PromptUtils.log('info', 'Restoring version', { versionId });
      
      // Trigger restore event for platform-specific implementation
      this.triggerRestoreEvent(version);
      
      return version;
    } catch (error) {
      PromptUtils.log('error', 'Failed to restore version:', error);
      throw error;
    }
  }

  // Create a branch from a specific version
  async createBranch(versionId, newPrompt) {
    try {
      // First restore the version
      const baseVersion = await this.restoreVersion(versionId);
      
      // Create new session for the branch
      const branchSessionId = this.generateSessionId() + '_branch';
      const originalSessionId = this.currentSessionId;
      
      // Temporarily switch to branch session
      this.currentSessionId = branchSessionId;
      
      // Save the branch starting point
      await this.savePromptVersion(newPrompt, null, true);
      
      PromptUtils.log('info', 'Branch created', {
        fromVersionId: versionId,
        branchSessionId,
        originalSessionId
      });
      
      return {
        branchSessionId,
        originalSessionId,
        baseVersion
      };
    } catch (error) {
      PromptUtils.log('error', 'Failed to create branch:', error);
      throw error;
    }
  }

  // Switch between sessions/branches
  switchToSession(sessionId) {
    this.currentSessionId = sessionId;
    this.lastPrompt = '';
    this.lastResponse = '';
    
    PromptUtils.log('info', 'Switched to session', { sessionId });
    this.triggerUIUpdate();
  }

  // Set up automatic checkpoints
  setupAutoCheckpoints() {
    // Create checkpoint every 5 minutes of activity
    setInterval(() => {
      if (this.lastPrompt && this.isTracking) {
        this.createCheckpoint(
          this.lastPrompt, 
          this.lastResponse, 
          `Auto-checkpoint ${new Date().toLocaleTimeString()}`,
          'Automatic checkpoint created'
        );
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Search through version history
  async searchVersions(query, options = {}) {
    try {
      return await this.storage.searchPrompts(query, {
        sessionId: this.currentSessionId,
        ...options
      });
    } catch (error) {
      PromptUtils.log('error', 'Failed to search versions:', error);
      return [];
    }
  }

  // Export session data
  async exportSession(sessionId = null) {
    try {
      const targetSessionId = sessionId || this.currentSessionId;
      const sessionData = await this.storage.getHistory(targetSessionId);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        platform: this.platform,
        sessionId: targetSessionId,
        data: sessionData
      };
      
      return exportData;
    } catch (error) {
      PromptUtils.log('error', 'Failed to export session:', error);
      throw error;
    }
  }

  // Get statistics about current session
  async getSessionStats() {
    try {
      const history = await this.getSessionHistory();
      const checkpoints = history.filter(v => v.isCheckpoint);
      
      return {
        totalVersions: history.length,
        checkpoints: checkpoints.length,
        firstPrompt: history[history.length - 1]?.timestamp || null,
        lastPrompt: history[0]?.timestamp || null,
        platform: this.platform,
        sessionId: this.currentSessionId
      };
    } catch (error) {
      PromptUtils.log('error', 'Failed to get session stats:', error);
      return null;
    }
  }

  // Event system for UI updates
  triggerUIUpdate() {
    window.dispatchEvent(new CustomEvent('promptVersionUpdate', {
      detail: {
        sessionId: this.currentSessionId,
        platform: this.platform
      }
    }));
  }

  triggerRestoreEvent(version) {
    window.dispatchEvent(new CustomEvent('promptVersionRestore', {
      detail: {
        version: version,
        platform: this.platform
      }
    }));
  }

  // Clean up resources
  destroy() {
    this.stopTracking();
    PromptUtils.log('info', 'Version manager destroyed');
  }
}

// Make available globally
window.PromptVersionManager = PromptVersionManager;
