chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'CHROME_DOM_ACTION') return;

  try {
    const el = msg.selector ? document.querySelector(msg.selector) : null;
    if (msg.action === 'CLICK' && el) {
      el.click();
      sendResponse({ ok: true });
    } else if (msg.action === 'FILL' && el) {
      el.value = msg.value || '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      sendResponse({ ok: true });
    } else if (msg.action === 'EXTRACT') {
      const text = el ? el.textContent : document.body.innerText.slice(0, 4000);
      sendResponse({ ok: true, text });
    } else {
      sendResponse({ ok: false, error: 'Elemento ou ação não encontrada' });
    }
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
  return true;
});
