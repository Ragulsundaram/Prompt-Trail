// Background service worker for Prompt Trail
// Minimal implementation - just handles extension lifecycle

chrome.runtime.onInstalled.addListener((details) => {
  console.log('🛤️ Prompt Trail installed:', details.reason);
});

// Keep service worker alive (optional, for future features)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🛤️ Background received:', message.type);
  sendResponse({ success: true });
  return true;
});
