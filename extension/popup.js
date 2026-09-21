const exportButton = document.querySelector('#exportButton');
const status = document.querySelector('#status');
const tabContext = document.querySelector('#tabContext');
const connectionBadge = document.querySelector('#connectionBadge');
const contextPulse = document.querySelector('.context-pulse');

function isCalmUrl(value) {
  try {
    const pageUrl = new URL(value || '');
    return pageUrl.protocol === 'https:' && pageUrl.hostname.toLowerCase().endsWith('.alm.cloud.sap');
  } catch {
    return false;
  }
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function setContext(ready, hostname = '') {
  if (ready) {
    connectionBadge.textContent = 'Bereit';
    connectionBadge.classList.add('badge-ready');
    tabContext.textContent = hostname || 'SAP Cloud ALM ist geöffnet';
    contextPulse.style.background = 'var(--accent)';
    contextPulse.style.boxShadow = '0 0 0 4px rgb(13 159 139 / 14%)';
    return;
  }
  connectionBadge.textContent = 'Wird benötigt';
  connectionBadge.classList.remove('badge-ready');
  tabContext.textContent = 'SAP Cloud ALM noch nicht geöffnet';
  contextPulse.style.background = 'var(--signal)';
  contextPulse.style.boxShadow = '0 0 0 4px rgb(228 169 67 / 14%)';
}

async function refreshContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const ready = isCalmUrl(tab?.url);
    setContext(ready, ready ? new URL(tab.url).hostname : '');
  } catch {
    setContext(false);
  }
}

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  setStatus('SAP Cloud ALM wird geprüft …');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Kein aktiver Browser-Tab gefunden.');
    if (!isCalmUrl(tab.url)) throw new Error('Bitte zuerst eine SAP-Cloud-ALM-Seite öffnen.');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      files: ['exporter-main.js'],
    });
    setContext(true, new URL(tab.url).hostname);
    setStatus('Export gestartet. Fortschritt erscheint in SAP Cloud ALM.');
  } catch (error) {
    setStatus(error?.message || String(error), true);
  } finally {
    exportButton.disabled = false;
  }
});

refreshContext();
