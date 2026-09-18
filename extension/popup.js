const exportButton = document.querySelector('#exportButton');
const status = document.querySelector('#status');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#b42318' : '';
}

exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  setStatus('SAP Cloud ALM wird geprüft …');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    if (!/^https:\/\/[^/]+\.alm\.cloud\.sap\//i.test(url)) {
      throw new Error('Bitte zuerst eine SAP-Cloud-ALM-Seite öffnen.');
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      files: ['exporter-main.js'],
    });
    setStatus('Export gestartet. Fortschritt erscheint in SAP Cloud ALM.');
  } catch (error) {
    setStatus(error?.message || String(error), true);
  } finally {
    exportButton.disabled = false;
  }
});
