// Popup script for Prompt Trail

async function init() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const toggleBtn = document.getElementById('toggle-btn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const isChatGPT = tab?.url?.includes('chat.openai.com') || 
                      tab?.url?.includes('chatgpt.com');

    if (isChatGPT) {
      statusDot.classList.add('active');
      statusText.classList.add('active');
      statusText.textContent = 'Active on ChatGPT';
      toggleBtn.disabled = false;

      toggleBtn.addEventListener('click', async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
          window.close();
        } catch (err) {
          console.error('Failed to toggle sidebar:', err);
        }
      });
    } else {
      statusText.textContent = 'Not on ChatGPT';
      toggleBtn.disabled = true;
    }
  } catch (error) {
    console.error('Popup init error:', error);
  }
}

document.addEventListener('DOMContentLoaded', init);
