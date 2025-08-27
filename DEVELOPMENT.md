# Development Guide - P3. **Test on ChatGPT:**
   - Visit https://chatgpt.com or https://chat.openai.com
   - Open browser console (F12) to see logs
   - Start typing in the chat input - versions should be tracked automatically
   - Use `Ctrl+Shift+V` to toggle the sidebar (or click the extension icon) Version Tracking Extension

## 🚀 Quick Start

### Prerequisites
- Chrome or Firefox browser for testing
- Code editor (VS Code recommended)
- Basic knowledge of JavaScript and browser extensions

### Installation for Development

1. **Clone/Download the project**
   ```bash
   cd "Prompt Versioning"
   ```

2. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the project folder
   - The extension should now appear in your extensions list

3. **Test on ChatGPT:**
   - Navigate to https://chat.openai.com
   - Open browser console (F12) to see logs
   - Start typing in the chat input - versions should be tracked automatically
   - Use `Ctrl+Shift+V` to toggle the sidebar (or click the extension icon)

## 🏗 Architecture Overview

### File Structure
```
/
├── manifest.json              # Extension configuration
├── background/
│   └── background.js          # Service worker (handles storage, messaging)
├── content/
│   ├── shared/                # Shared utilities across platforms
│   │   ├── utils.js          # Utility functions
│   │   ├── storage.js        # Storage management
│   │   └── version-manager.js # Core version tracking logic
│   ├── platforms/             # Platform-specific adapters
│   │   ├── chatgpt.js        # ChatGPT integration (IMPLEMENTED)
│   │   ├── gemini.js         # Gemini integration (TODO)
│   │   └── claude.js         # Claude integration (TODO)
│   └── styles/
│       └── sidebar.css       # Sidebar styling
├── popup/                     # Extension popup
│   ├── popup.html
│   └── popup.js
├── sidebar/                   # Side panel interface
│   ├── sidebar.html
│   └── sidebar.js
└── icons/                     # Extension icons
```

### Data Flow
1. **Content Script** (platform adapter) detects prompt changes
2. **Version Manager** processes and validates changes
3. **Storage Manager** communicates with background script
4. **Background Script** handles data persistence
5. **UI Components** (sidebar/popup) display and manage versions

## 🛠 Current Implementation Status

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Extension manifest and structure
- [x] Background service worker
- [x] Core storage system
- [x] Version management system
- [x] Basic UI framework

### ✅ Phase 2: ChatGPT Integration (IMPLEMENTED)
- [x] ChatGPT DOM detection
- [x] Automatic prompt change tracking
- [x] Manual checkpoint creation
- [x] Response capture
- [x] Sidebar UI with version history
- [x] Prompt restoration functionality

### 🚧 Next Steps (Phase 3+)
- [ ] Gemini platform integration
- [ ] Claude platform integration
- [ ] Advanced branching system
- [ ] Enhanced UI/UX
- [ ] Export/import functionality

## 🔧 Development Workflow

### Making Changes

1. **Edit the code** in your preferred editor
2. **Reload the extension** in Chrome:
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension
3. **Test the changes** on the target platform
4. **Check console logs** for debugging information

### Debugging

- **Console Logs**: All components use `PromptUtils.log()` for consistent logging
- **Storage Inspection**: 
  ```javascript
  // In browser console
  chrome.storage.local.get(['promptVersions'], console.log);
  ```
- **Event Debugging**: Watch for custom events in the console
- **Network Tab**: Monitor extension messaging in DevTools

### Testing Checklist

#### ChatGPT Testing
- [ ] Extension loads without errors
- [ ] Typing in chat input triggers version tracking
- [ ] Submitting prompts creates checkpoints
- [ ] Sidebar shows version history
- [ ] Restore button works correctly
- [ ] Branch functionality works
- [ ] Response capture works

## 📝 Adding New Platform Support

### Step 1: Create Platform Adapter
1. Copy `content/platforms/chatgpt.js` to your platform file
2. Modify the DOM selectors for your platform
3. Update event listeners for platform-specific behaviors
4. Test prompt detection and restoration

### Step 2: Update Manifest
1. Add your platform's URL to `host_permissions`
2. Add content script configuration for your platform

### Step 3: Platform-Specific Considerations

**Gemini (bard.google.com):**
- Different text input structure
- Google-specific authentication handling
- Response format differences

**Claude (claude.ai):**
- Anthropic's custom UI framework
- Different conversation structure
- Potential React-based interactions

## 🎯 Key Implementation Details

### Prompt Change Detection
```javascript
// Current approach uses input events with debouncing
const debouncedTextChange = PromptUtils.debounce((text) => {
  this.handleTextChange(text);
}, 1000);
```

### Storage Schema
```javascript
{
  sessions: {
    [sessionId]: {
      platform: 'chatgpt|gemini|claude',
      created: timestamp,
      versions: [versionId],
      branches: []
    }
  },
  versions: {
    [versionId]: {
      prompt: string,
      response: string,
      timestamp: number,
      isCheckpoint: boolean,
      tags: []
    }
  }
}
```

### Event System
- `promptVersionUpdate`: Fired when versions change
- `promptVersionRestore`: Fired when restoring a version

## 🚀 Deployment

### Development Testing
1. Load unpacked extension in Chrome
2. Test on all supported platforms
3. Verify data persistence
4. Test export/import functionality

### Production Packaging
```bash
npm run package
# Creates prompt-version-tracking.zip
```

### Store Submission
1. Chrome Web Store: Upload zip file
2. Firefox Add-ons: Use web-ext tool
3. Edge Add-ons: Use same Chrome package

## 🤝 Contributing

### Code Standards
- Use ES6+ features
- Follow existing naming conventions
- Add comprehensive error handling
- Include debug logging
- Write clear comments

### Git Workflow
1. Create feature branch
2. Make changes with descriptive commits
3. Test thoroughly
4. Create pull request

### Issue Reporting
Include:
- Platform and browser version
- Steps to reproduce
- Console error messages
- Expected vs actual behavior

## 🔍 Troubleshooting

### Common Issues

**Extension not loading:**
- Check manifest.json syntax
- Verify file paths
- Check browser console for errors

**Prompt tracking not working:**
- Verify platform detection
- Check DOM selectors
- Confirm event listeners are attached

**Storage issues:**
- Clear extension data: `chrome.storage.local.clear()`
- Check storage permissions in manifest

**UI not appearing:**
- Verify CSS is loading
- Check for conflicting styles
- Confirm DOM insertion

### Debug Commands
```javascript
// Check current storage
chrome.storage.local.get(console.log);

// Clear all data
chrome.storage.local.clear();

// Test version manager
window.chatGPTAdapter?.versionManager?.getSessionHistory();
```

## 📊 Performance Considerations

- **Debounced input handling** prevents excessive API calls
- **Efficient DOM queries** using cached selectors
- **Storage optimization** with compression for large datasets
- **Memory management** for long browsing sessions

## 🔒 Privacy & Security

- **Local storage only** - no data sent to external servers
- **Content script isolation** prevents interference with host pages
- **Secure messaging** between extension components
- **Permission minimization** - only requests necessary permissions

---

*Happy coding! 🚀*
