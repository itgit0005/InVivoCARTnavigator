async function renderAiAnalystPage(container) {
  container.innerHTML = '';
  container.appendChild(h('div', { class: 'bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-sm text-blue-800' }, [
    h('i', { class: 'fa-solid fa-robot mr-2' }),
    'The AI Analyst answers strictly from the verified platform database and cites its sources. It will never use outside knowledge or make unsupported claims.',
  ]));

  const chatBox = h('div', { id: 'chat-box', class: 'space-y-4 mb-4 max-h-[55vh] overflow-y-auto pr-2' });
  container.appendChild(h('div', { class: 'kpi-card' }, [chatBox]));

  const inputRow = h('div', { class: 'flex items-center gap-2 mt-4' });
  const input = h('input', { type: 'text', placeholder: 'Ask about companies, assets, deals, targets, trials...', class: 'flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm' });
  const sendBtn = h('button', { class: 'btn btn-primary' }, [h('i', { class: 'fa-solid fa-paper-plane' }), 'Ask']);
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  container.appendChild(inputRow);

  container.appendChild(h('div', { class: 'text-xs text-slate-400 mt-2' }, 'Example: "Which companies target CD19?" · "What is the status of UB-VV400?" · "Summarize the Kelonia acquisition deal terms."'));

  function addBubble(text, who) {
    const bubble = h('div', { class: 'flex ' + (who === 'user' ? 'justify-end' : 'justify-start') });
    const inner = h('div', {
      class: (who === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai') + ' px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap',
      html: who === 'ai' ? mdLite(text) : esc(text),
    });
    bubble.appendChild(inner);
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function mdLite(text) {
    return esc(text)
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="source-link">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  async function send() {
    const q = input.value.trim();
    if (!q) return;
    addBubble(q, 'user');
    input.value = '';
    sendBtn.disabled = true;
    const loadingBubble = h('div', { class: 'flex justify-start' }, h('div', { class: 'chat-bubble-ai px-4 py-2.5' }, h('div', { class: 'spinner', style: 'width:1rem;height:1rem;border-width:2px;' })));
    chatBox.appendChild(loadingBubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    try {
      const data = await API.post('/ai/ask', { question: q, month: STATE.currentMonth });
      loadingBubble.remove();
      addBubble(data.answer, 'ai');
    } catch (e) {
      loadingBubble.remove();
      addBubble('Error: ' + e.message, 'ai');
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  addBubble('Hi! I am the AI Analyst for the In Vivo CAR-T Navigator. Ask me anything about the tracked companies, assets, trials, deals, or targets — I will answer only from verified platform data and cite sources.', 'ai');
}
