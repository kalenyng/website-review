(function () {
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAWzDSFsaNTRSONHzF8oaX2UJGrOCMRSuI',
    authDomain: 'websitereview-817d4.firebaseapp.com',
    projectId: 'websitereview-817d4',
    storageBucket: 'websitereview-817d4.firebasestorage.app',
    messagingSenderId: '243157984622',
    appId: '1:243157984622:web:e2c53e4a7aaf450aa8cd7f',
  };

  const FIREBASE_APP_COMPAT = 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js';
  const FIREBASE_FIRESTORE_COMPAT =
    'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore-compat.js';

  const STYLE_ID = 'wr-widget-style';
  const PINS_ID = 'wr-widget-pins';
  const SIDEBAR_ID = 'wr-widget-sidebar';
  const NAME_MODAL_ID = 'wr-widget-name-modal';
  const COMMENT_MODAL_ID = 'wr-widget-comment-modal';
  const HOVER_ID = 'wr-widget-hover-outline';
  const LOCAL_STORAGE_USER_KEY = 'reviewUser';

  let teardownRealtime = null;
  let mode = 'view';
  let currentProjectId = '';
  let currentUser = '';
  let comments = [];
  let selectedCommentId = null;
  let isSidebarCollapsed = false;
  let pinsRoot = null;
  let sidebarRoot = null;
  let modalRoot = null;
  let commentModalRoot = null;
  let db = null;
  let sidebarListEl = null;
  let sidebarCountEl = null;
  let modeCommentBtn = null;
  let modeViewBtn = null;
  let modeSwitchBtn = null;
  let hoverRoot = null;
  let hoveredElement = null;
  let hoverRafId = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      });
      script.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)));
      document.head.appendChild(script);
    });
  }

  async function ensureFirebaseLoaded() {
    if (window.firebase && window.firebase.firestore) {
      return;
    }
    await loadScript(FIREBASE_APP_COMPAT);
    await loadScript(FIREBASE_FIRESTORE_COMPAT);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${SIDEBAR_ID} {
        position: fixed;
        left: 16px;
        top: auto;
        bottom: 16px;
        width: min(360px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(4px);
        border: 1px solid #d0d5dd;
        border-radius: 12px;
        box-shadow: 0 14px 34px rgba(16, 24, 40, 0.18);
        z-index: 2147483599;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: Inter, Arial, sans-serif;
        color: #101828;
        line-height: 1.4;
      }
      #${SIDEBAR_ID}.wr-collapsed {
        width: fit-content;
        max-width: calc(100vw - 32px);
        min-width: 0;
        bottom: 16px;
      }
      #${SIDEBAR_ID}.wr-collapsed .wr-comment-list,
      #${SIDEBAR_ID}.wr-collapsed .wr-sidebar-meta:not(.wr-sidebar-count) {
        display: none;
      }
      #${SIDEBAR_ID}.wr-collapsed .wr-sidebar-header {
        border-bottom: 0;
      }
      #${SIDEBAR_ID},
      #${SIDEBAR_ID} *,
      #${NAME_MODAL_ID},
      #${NAME_MODAL_ID} *,
      #${COMMENT_MODAL_ID},
      #${COMMENT_MODAL_ID} *,
      #${PINS_ID},
      #${PINS_ID} * {
        box-sizing: border-box;
      }
      #${SIDEBAR_ID} .wr-sidebar-header {
        padding: 12px;
        border-bottom: 1px solid #eaecf0;
      }
      #${SIDEBAR_ID} .wr-sidebar-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${SIDEBAR_ID} .wr-mode-row {
        margin-top: 8px;
        display: flex;
        align-items: center;
      }
      #${SIDEBAR_ID} .wr-segmented-toggle {
        position: relative;
        width: 176px;
        height: 34px;
        border: 1px solid #d0d5dd;
        border-radius: 999px;
        padding: 2px;
        background: #f2f4f7;
        cursor: pointer;
        overflow: hidden;
      }
      #${SIDEBAR_ID} .wr-segmented-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: calc(50% - 2px);
        height: calc(100% - 4px);
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.18);
        transform: translateX(0);
        transition: transform 0.22s ease;
      }
      #${SIDEBAR_ID} .wr-segmented-toggle.wr-active .wr-segmented-thumb {
        transform: translateX(calc(100% + 2px));
      }
      #${SIDEBAR_ID} .wr-segmented-labels {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        z-index: 1;
      }
      #${SIDEBAR_ID} .wr-mode-label {
        text-align: center;
        font-size: 12px;
        color: #667085;
        user-select: none;
        font-weight: 600;
      }
      #${SIDEBAR_ID} .wr-mode-label.wr-active {
        color: #101828;
      }
      #${SIDEBAR_ID} h3 {
        margin: 0 0 4px;
        font-size: 16px;
        color: #101828;
      }
      #${SIDEBAR_ID} .wr-collapse-btn {
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        background: #fff;
        padding: 4px 8px;
        cursor: pointer;
      }
      #${SIDEBAR_ID} .wr-sidebar-meta {
        font-size: 12px;
        color: #667085;
      }
      #${SIDEBAR_ID} .wr-sidebar-count {
        margin-top: 4px;
      }
      #${SIDEBAR_ID} .wr-comment-list {
        margin: 0;
        padding: 8px;
        list-style: none;
        overflow: auto;
        display: grid;
        gap: 8px;
      }
      #${SIDEBAR_ID} .wr-comment-item {
        border: 1px solid #eaecf0;
        border-radius: 10px;
        padding: 8px;
        cursor: pointer;
        background: #fff;
      }
      #${SIDEBAR_ID} .wr-comment-item.wr-active {
        border-color: #d92d20;
        background: #fff5f4;
      }
      #${SIDEBAR_ID} .wr-comment-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      #${SIDEBAR_ID} .wr-pin-number {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #d92d20;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      #${SIDEBAR_ID} .wr-comment-user {
        font-size: 13px;
        font-weight: 600;
        color: #101828;
      }
      #${SIDEBAR_ID} .wr-comment-date {
        color: #667085;
        font-size: 11px;
      }
      #${SIDEBAR_ID} .wr-comment-message {
        margin: 6px 0;
        font-size: 13px;
        color: #101828;
        white-space: pre-wrap;
      }
      #${SIDEBAR_ID} .wr-comment-status {
        display: inline-block;
        border-radius: 999px;
        font-size: 11px;
        padding: 2px 8px;
        background: #ecfdf3;
        color: #067647;
      }
      #${SIDEBAR_ID} .wr-comment-status.wr-resolved {
        background: #f2f4f7;
        color: #344054;
      }
      #${SIDEBAR_ID} .wr-empty {
        border: 1px dashed #d0d5dd;
        border-radius: 10px;
        padding: 14px;
        text-align: center;
        color: #667085;
        font-size: 13px;
      }
      #${NAME_MODAL_ID} {
        position: fixed;
        inset: 0;
        background: rgba(16, 24, 40, 0.45);
        z-index: 2147483601;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Inter, Arial, sans-serif;
      }
      #${NAME_MODAL_ID} .wr-modal-card {
        width: min(420px, calc(100vw - 24px));
        background: #fff;
        color: #101828;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(16, 24, 40, 0.25);
        padding: 16px;
      }
      #${NAME_MODAL_ID} h3 {
        margin: 0 0 6px;
      }
      #${NAME_MODAL_ID} p {
        margin: 0 0 10px;
        color: #475467;
        font-size: 14px;
      }
      #${NAME_MODAL_ID} .wr-name-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        padding: 8px 10px;
        margin-bottom: 10px;
      }
      #${NAME_MODAL_ID} .wr-primary {
        border: 1px solid #d92d20;
        background: #d92d20;
        color: #fff;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
      }
      #${COMMENT_MODAL_ID} {
        position: fixed;
        inset: 0;
        background: rgba(16, 24, 40, 0.45);
        z-index: 2147483601;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Inter, Arial, sans-serif;
      }
      #${COMMENT_MODAL_ID} .wr-modal-card {
        width: min(480px, calc(100vw - 24px));
        background: #fff;
        color: #101828;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(16, 24, 40, 0.25);
        padding: 16px;
      }
      #${COMMENT_MODAL_ID} h3 {
        margin: 0 0 6px;
        color: #101828;
        font-size: 20px;
        font-weight: 700;
        font-family: Inter, Arial, sans-serif;
      }
      #${COMMENT_MODAL_ID} p {
        margin: 0 0 10px;
        color: #475467;
        font-size: 14px;
        font-family: Inter, Arial, sans-serif;
      }
      #${COMMENT_MODAL_ID} .wr-comment-input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #d0d5dd;
        border-radius: 8px;
        padding: 10px;
        min-height: 96px;
        margin-bottom: 10px;
        resize: vertical;
        font: inherit;
        color: #101828;
        background: #fff;
        font-family: Inter, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }
      #${COMMENT_MODAL_ID} .wr-comment-input::placeholder {
        color: #667085;
      }
      #${COMMENT_MODAL_ID} .wr-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      #${COMMENT_MODAL_ID} .wr-secondary {
        border: 1px solid #d0d5dd;
        background: #fff;
        color: #344054;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-family: Inter, Arial, sans-serif;
        font-size: 14px;
        font-weight: 600;
      }
      #${COMMENT_MODAL_ID} .wr-primary {
        border: 1px solid #d92d20;
        background: #d92d20;
        color: #fff;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-family: Inter, Arial, sans-serif;
        font-size: 14px;
        font-weight: 600;
      }
      #${HOVER_ID} {
        position: fixed;
        pointer-events: none;
        border: 2px solid #d92d20;
        background: rgba(217, 45, 32, 0.08);
        border-radius: 4px;
        z-index: 2147483490;
        display: none;
      }
      #${PINS_ID} {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483500;
      }
      #${PINS_ID} .wr-pin {
        position: absolute;
        transform: translate(-50%, -50%);
        width: 26px;
        height: 26px;
        border-radius: 999px;
        border: 2px solid #fff;
        background: #d92d20;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(16, 24, 40, 0.3);
      }
      #${PINS_ID} .wr-pin.wr-active {
        box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.22), 0 2px 8px rgba(16, 24, 40, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  function cssEscape(value) {
    if (!value) {
      return '';
    }
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function getSelector(target) {
    if (!target || target.nodeType !== 1) {
      return '';
    }
    if (target.id) {
      return `#${cssEscape(target.id)}`;
    }

    const segments = [];
    let node = target;
    while (node && node.nodeType === 1 && node !== document.body) {
      const tag = node.tagName.toLowerCase();
      const className = (node.className || '')
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0];
      const classPart = className ? `.${cssEscape(className)}` : '';
      const siblings = Array.from(node.parentElement ? node.parentElement.children : []).filter(
        (sibling) => sibling.tagName === node.tagName,
      );
      const index = siblings.indexOf(node) + 1;
      segments.unshift(`${tag}${classPart}:nth-of-type(${index})`);
      node = node.parentElement;
    }
    return `body > ${segments.join(' > ')}`;
  }

  function resolvePinPosition(comment) {
    let pageX = Number(comment.pageX || 0);
    let pageY = Number(comment.pageY || 0);

    if (comment.selector) {
      const el = document.querySelector(comment.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const offsetX = Number(comment.offsetX || 0);
        const offsetY = Number(comment.offsetY || 0);
        pageX = window.scrollX + rect.left + rect.width * offsetX;
        pageY = window.scrollY + rect.top + rect.height * offsetY;
      }
    }

    return {
      x: pageX,
      y: pageY,
    };
  }

  function formatTimestamp(comment) {
    if (comment.createdAt && comment.createdAt.toDate) {
      return comment.createdAt.toDate().toLocaleString();
    }
    return '';
  }

  function renderPins() {
    if (!pinsRoot) {
      return;
    }
    pinsRoot.innerHTML = '';

    comments.forEach((comment, index) => {
      const pos = resolvePinPosition(comment);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'wr-pin';
      if (selectedCommentId === comment.id) {
        pin.classList.add('wr-active');
      }
      pin.textContent = String(index + 1);
      pin.style.left = `${pos.x}px`;
      pin.style.top = `${pos.y}px`;
      pin.title = `${comment.createdBy || 'Guest'}: ${comment.message || ''}`;
      pin.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedCommentId = comment.id;
        renderPins();
        renderSidebar();
      });
      pinsRoot.appendChild(pin);
    });
  }

  function renderSidebar() {
    if (!sidebarRoot || !sidebarListEl || !sidebarCountEl) {
      return;
    }
    sidebarRoot.classList.toggle('wr-collapsed', isSidebarCollapsed);
    if (isSidebarCollapsed) {
      return;
    }

    sidebarCountEl.textContent = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;
    sidebarListEl.innerHTML = '';

    if (comments.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'wr-empty';
      empty.textContent = 'No comments yet. Switch to Comment mode and click anywhere.';
      sidebarListEl.appendChild(empty);
      return;
    }

    comments.forEach((comment, index) => {
      const li = document.createElement('li');
      li.className = 'wr-comment-item';
      if (comment.id === selectedCommentId) {
        li.classList.add('wr-active');
      }
      li.addEventListener('click', () => {
        selectedCommentId = comment.id;
        renderPins();
        renderSidebar();
      });

      const row = document.createElement('div');
      row.className = 'wr-comment-row';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';
      const num = document.createElement('span');
      num.className = 'wr-pin-number';
      num.textContent = String(index + 1);
      const user = document.createElement('span');
      user.className = 'wr-comment-user';
      user.textContent = comment.createdBy || 'Guest';
      left.appendChild(num);
      left.appendChild(user);

      const date = document.createElement('span');
      date.className = 'wr-comment-date';
      date.textContent = formatTimestamp(comment);
      row.appendChild(left);
      row.appendChild(date);

      const message = document.createElement('div');
      message.className = 'wr-comment-message';
      message.textContent = comment.message || '';

      const status = document.createElement('span');
      status.className = 'wr-comment-status';
      const s = comment.status || 'open';
      if (s === 'resolved') {
        status.classList.add('wr-resolved');
      }
      status.textContent = s;

      li.appendChild(row);
      li.appendChild(message);
      li.appendChild(status);
      sidebarListEl.appendChild(li);
    });
  }

  function attachPinRoot() {
    let existing = document.getElementById(PINS_ID);
    if (!existing) {
      existing = document.createElement('div');
      existing.id = PINS_ID;
      document.body.appendChild(existing);
    }
    pinsRoot = existing;
  }

  function ensureHoverRoot() {
    let existing = document.getElementById(HOVER_ID);
    if (!existing) {
      existing = document.createElement('div');
      existing.id = HOVER_ID;
      document.body.appendChild(existing);
    }
    hoverRoot = existing;
  }

  function isWidgetElement(target) {
    if (!target || !(target instanceof Element)) {
      return false;
    }
    return Boolean(
      target.closest(`#${SIDEBAR_ID}`) ||
        target.closest(`#${PINS_ID}`) ||
        target.closest(`#${NAME_MODAL_ID}`) ||
        target.closest(`#${COMMENT_MODAL_ID}`),
    );
  }

  function hideHoverOutline() {
    hoveredElement = null;
    if (hoverRoot) {
      hoverRoot.style.display = 'none';
    }
  }

  function updateHoverOutlineFromElement(element) {
    if (!hoverRoot || !element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      hideHoverOutline();
      return;
    }
    hoverRoot.style.display = 'block';
    hoverRoot.style.left = `${rect.left}px`;
    hoverRoot.style.top = `${rect.top}px`;
    hoverRoot.style.width = `${rect.width}px`;
    hoverRoot.style.height = `${rect.height}px`;
  }

  function handleDocumentPointerMove(event) {
    if (mode !== 'comment') {
      hideHoverOutline();
      return;
    }
    if (isWidgetElement(event.target)) {
      hideHoverOutline();
      return;
    }

    if (hoverRafId) {
      cancelAnimationFrame(hoverRafId);
    }
    hoverRafId = requestAnimationFrame(() => {
      const hovered = document.elementFromPoint(event.clientX, event.clientY);
      if (!hovered || isWidgetElement(hovered)) {
        hideHoverOutline();
        return;
      }
      hoveredElement = hovered;
      updateHoverOutlineFromElement(hoveredElement);
    });
  }

  function ensureUserNameBeforeUsing() {
    return new Promise((resolve) => {
      const normalizedCurrent = (currentUser || '').trim();
      if (normalizedCurrent && normalizedCurrent.toLowerCase() !== 'guest') {
        currentUser = normalizedCurrent;
        resolve();
        return;
      }

      if (modalRoot) {
        modalRoot.remove();
      }

      modalRoot = document.createElement('div');
      modalRoot.id = NAME_MODAL_ID;

      const card = document.createElement('section');
      card.className = 'wr-modal-card';
      const title = document.createElement('h3');
      title.textContent = 'Enter display name';
      const subtitle = document.createElement('p');
      subtitle.textContent = 'You must enter a name before placing or viewing comments.';
      const input = document.createElement('input');
      input.className = 'wr-name-input';
      input.placeholder = 'Your name';
      const storedName = localStorage.getItem(LOCAL_STORAGE_USER_KEY) || '';
      input.value = storedName.toLowerCase() === 'guest' ? '' : storedName;
      const submit = document.createElement('button');
      submit.className = 'wr-primary';
      submit.type = 'button';
      submit.textContent = 'Continue';
      submit.addEventListener('click', () => {
        const name = input.value.trim();
        if (!name || name.toLowerCase() === 'guest') {
          input.focus();
          return;
        }
        currentUser = name;
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, name);
        modalRoot.remove();
        modalRoot = null;
        resolve();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit.click();
        }
      });

      card.appendChild(title);
      card.appendChild(subtitle);
      card.appendChild(input);
      card.appendChild(submit);
      modalRoot.appendChild(card);
      document.body.appendChild(modalRoot);
      input.focus();
    });
  }

  function openCommentModal() {
    return new Promise((resolve) => {
      if (commentModalRoot) {
        commentModalRoot.remove();
      }

      commentModalRoot = document.createElement('div');
      commentModalRoot.id = COMMENT_MODAL_ID;

      const card = document.createElement('section');
      card.className = 'wr-modal-card';
      const title = document.createElement('h3');
      title.textContent = 'Add comment';
      const subtitle = document.createElement('p');
      subtitle.textContent = 'Share your feedback for this spot on the page.';
      const textarea = document.createElement('textarea');
      textarea.className = 'wr-comment-input';
      textarea.placeholder = 'Write your feedback...';

      const actions = document.createElement('div');
      actions.className = 'wr-modal-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'wr-secondary';
      cancelBtn.textContent = 'Cancel';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'wr-primary';
      saveBtn.textContent = 'Add comment';

      const cleanup = () => {
        if (commentModalRoot) {
          commentModalRoot.remove();
          commentModalRoot = null;
        }
      };

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      saveBtn.addEventListener('click', () => {
        const value = textarea.value.trim();
        if (!value) {
          textarea.focus();
          return;
        }
        cleanup();
        resolve(value);
      });

      textarea.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          saveBtn.click();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelBtn.click();
        }
      });

      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      card.appendChild(title);
      card.appendChild(subtitle);
      card.appendChild(textarea);
      card.appendChild(actions);
      commentModalRoot.appendChild(card);
      document.body.appendChild(commentModalRoot);
      textarea.focus();
    });
  }

  async function handleDocumentClick(event) {
    if (mode !== 'comment') {
      return;
    }
    if (
      (sidebarRoot && sidebarRoot.contains(event.target)) ||
      (modalRoot && modalRoot.contains(event.target)) ||
      (commentModalRoot && commentModalRoot.contains(event.target))
    ) {
      return;
    }

    const clickedEl = document.elementFromPoint(event.clientX, event.clientY);
    if (!clickedEl || clickedEl.closest(`#${PINS_ID}`)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selector = getSelector(clickedEl);
    const rect = clickedEl.getBoundingClientRect();
    const offsetX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const offsetY = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
    const message = await openCommentModal();
    if (!message || !message.trim()) {
      return;
    }

    db.collection('comments').add({
      projectId: currentProjectId,
      createdBy: currentUser,
      message: message.trim(),
      status: 'open',
      selector,
      offsetX,
      offsetY,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      pageX: window.scrollX + event.clientX,
      pageY: window.scrollY + event.clientY,
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      pageUrl: window.location.href,
    });
  }

  function onScrollOrResize() {
    renderPins();
    if (mode === 'comment' && hoveredElement) {
      updateHoverOutlineFromElement(hoveredElement);
    }
  }

  function updateModeButtons() {
    if (modeCommentBtn) {
      modeCommentBtn.classList.toggle('wr-active', mode === 'comment');
    }
    if (modeViewBtn) {
      modeViewBtn.classList.toggle('wr-active', mode === 'view');
    }
    if (modeSwitchBtn) {
      modeSwitchBtn.classList.toggle('wr-active', mode === 'view');
      modeSwitchBtn.setAttribute('aria-checked', String(mode === 'view'));
      modeSwitchBtn.setAttribute(
        'aria-label',
        mode === 'view' ? 'Switch to comment mode' : 'Switch to view mode',
      );
    }
    if (mode !== 'comment') {
      hideHoverOutline();
    }
  }

  function createSidebarUI() {
    const existing = document.getElementById(SIDEBAR_ID);
    if (existing) {
      existing.remove();
    }
    sidebarRoot = document.createElement('aside');
    sidebarRoot.id = SIDEBAR_ID;

    const header = document.createElement('div');
    header.className = 'wr-sidebar-header';
    const headerTop = document.createElement('div');
    headerTop.className = 'wr-sidebar-header-top';
    const title = document.createElement('h3');
    title.textContent = 'Review Comments';
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'wr-collapse-btn';
    collapseBtn.textContent = 'Collapse';
    collapseBtn.addEventListener('click', () => {
      isSidebarCollapsed = !isSidebarCollapsed;
      collapseBtn.textContent = isSidebarCollapsed ? 'Expand' : 'Collapse';
      renderSidebar();
    });
    headerTop.appendChild(title);
    headerTop.appendChild(collapseBtn);
    const meta = document.createElement('div');
    meta.className = 'wr-sidebar-meta';
    meta.textContent = 'Realtime sync enabled';
    const modeRow = document.createElement('div');
    modeRow.className = 'wr-mode-row';
    modeSwitchBtn = document.createElement('button');
    modeSwitchBtn.type = 'button';
    modeSwitchBtn.className = 'wr-segmented-toggle';
    modeSwitchBtn.setAttribute('role', 'switch');
    modeSwitchBtn.addEventListener('click', () => {
      mode = mode === 'comment' ? 'view' : 'comment';
      updateModeButtons();
    });
    const modeThumb = document.createElement('span');
    modeThumb.className = 'wr-segmented-thumb';
    const modeLabels = document.createElement('span');
    modeLabels.className = 'wr-segmented-labels';
    modeCommentBtn = document.createElement('span');
    modeCommentBtn.className = 'wr-mode-label';
    modeCommentBtn.textContent = 'Comment';
    modeViewBtn = document.createElement('span');
    modeViewBtn.className = 'wr-mode-label';
    modeViewBtn.textContent = 'View';
    modeLabels.appendChild(modeCommentBtn);
    modeLabels.appendChild(modeViewBtn);
    modeSwitchBtn.appendChild(modeThumb);
    modeSwitchBtn.appendChild(modeLabels);
    modeRow.appendChild(modeSwitchBtn);
    sidebarCountEl = document.createElement('div');
    sidebarCountEl.className = 'wr-sidebar-meta wr-sidebar-count';
    sidebarCountEl.textContent = '0 comments';
    header.appendChild(headerTop);
    header.appendChild(meta);
    header.appendChild(modeRow);
    header.appendChild(sidebarCountEl);

    sidebarListEl = document.createElement('ul');
    sidebarListEl.className = 'wr-comment-list';

    sidebarRoot.appendChild(header);
    sidebarRoot.appendChild(sidebarListEl);
    document.body.appendChild(sidebarRoot);
  }

  async function initWidget(options) {
    const settings = options || {};
    const projectId = settings.projectId;
    if (!projectId) {
      throw new Error('WebsiteReviewWidget: projectId is required');
    }

    currentProjectId = projectId;
    currentUser =
      (settings.userName && String(settings.userName).trim()) ||
      localStorage.getItem(LOCAL_STORAGE_USER_KEY) ||
      '';
    if (currentUser.toLowerCase() === 'guest') {
      currentUser = '';
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    }

    injectStyles();
    attachPinRoot();
    ensureHoverRoot();
    createSidebarUI();
    await ensureUserNameBeforeUsing();

    await ensureFirebaseLoaded();
    const firebaseConfig = settings.firebaseConfig || DEFAULT_FIREBASE_CONFIG;
    const appName = `wr-widget-${firebaseConfig.projectId}`;
    const app =
      window.firebase.apps.find((item) => item.name === appName) ||
      window.firebase.initializeApp(firebaseConfig, appName);
    db = window.firebase.firestore(app);

    updateModeButtons();

    if (teardownRealtime) {
      teardownRealtime();
      teardownRealtime = null;
    }
    teardownRealtime = db
      .collection('comments')
      .where('projectId', '==', currentProjectId)
      .onSnapshot((snapshot) => {
        comments = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return at - bt;
          });
        if (!selectedCommentId && comments.length > 0) {
          selectedCommentId = comments[0].id;
        }
        updateModeButtons();
        renderPins();
        renderSidebar();
      });

    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('pointermove', handleDocumentPointerMove, true);
  }

  function destroyWidget() {
    if (teardownRealtime) {
      teardownRealtime();
      teardownRealtime = null;
    }
    document.removeEventListener('click', handleDocumentClick, true);
    document.removeEventListener('pointermove', handleDocumentPointerMove, true);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    const style = document.getElementById(STYLE_ID);
    if (style) {
      style.remove();
    }
    if (sidebarRoot) {
      sidebarRoot.remove();
      sidebarRoot = null;
    }
    modeCommentBtn = null;
    modeViewBtn = null;
    modeSwitchBtn = null;
    if (modalRoot) {
      modalRoot.remove();
      modalRoot = null;
    }
    if (commentModalRoot) {
      commentModalRoot.remove();
      commentModalRoot = null;
    }
    if (pinsRoot) {
      pinsRoot.remove();
      pinsRoot = null;
    }
    if (hoverRoot) {
      hoverRoot.remove();
      hoverRoot = null;
    }
  }

  window.WebsiteReviewWidget = {
    init: initWidget,
    destroy: destroyWidget,
  };

  async function resolveTokenToProjectId(token, firebaseConfig) {
    try {
      await ensureFirebaseLoaded();
      const cfg = firebaseConfig || DEFAULT_FIREBASE_CONFIG;
      const appName = `wr-widget-${cfg.projectId}`;
      const app =
        window.firebase.apps.find((item) => item.name === appName) ||
        window.firebase.initializeApp(cfg, appName);
      const firestore = window.firebase.firestore(app);
      console.debug('[WebsiteReview] Resolving token:', token, '| Firebase project:', cfg.projectId);
      const snapshot = await firestore
        .collection('projects')
        .where('token', '==', token)
        .limit(1)
        .get();
      if (snapshot.empty) {
        console.warn('[WebsiteReview] No project found for token:', token);
        return null;
      }
      const projectId = snapshot.docs[0].id;
      console.debug('[WebsiteReview] Token resolved to projectId:', projectId);
      return projectId;
    } catch (err) {
      console.error('[WebsiteReview] Token resolution failed:', err);
      return null;
    }
  }

  const autoScript = document.currentScript;
  const urlParams = new URLSearchParams(window.location.search);
  const reviewToken = urlParams.get('review');

  if (reviewToken) {
    resolveTokenToProjectId(reviewToken).then((projectId) => {
      if (!projectId) {
        return;
      }
      initWidget({ projectId }).catch((error) => {
        console.error(error);
      });
    });
  } else if (autoScript && autoScript.dataset && autoScript.dataset.projectId) {
    initWidget({
      projectId: autoScript.dataset.projectId,
    }).catch((error) => {
      console.error(error);
    });
  }
})();
