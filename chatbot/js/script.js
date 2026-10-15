(() => {
  const STORAGE_KEY = "nora-chat-history";
  const MEMORY_STORAGE_KEY = "nora-long-term-memory";
  const RESPONSE_DELAY_MS = 1500;
  const form = document.querySelector("#message-form");
  const input = document.querySelector("#message-input");
  const sendButton = document.querySelector("#send-button");
  const clearButton = document.querySelector("#clear-button");
  const messagesElement = document.querySelector("#messages");
  const welcomeElement = document.querySelector("#welcome");
  const typingElement = document.querySelector("#typing-indicator");
  const chatContent = document.querySelector("#chat-content");
  const noticeElement = document.querySelector("#notice");
  const suggestions = document.querySelectorAll(".suggestion");
  const providerSelect = document.querySelector("#provider-select");
  const connectionStatus = document.querySelector("#connection-status");
  const statusDot = document.querySelector(".status-dot");
  const memoryButton = document.querySelector("#memory-button");
  const memoryDialog = document.querySelector("#memory-dialog");
  const memoryForm = document.querySelector("#memory-form");
  const memoryInput = document.querySelector("#memory-input");
  const memoryList = document.querySelector("#memory-list");
  const memoryCount = document.querySelector("#memory-count");

  let messages = loadMessages();
  let replyPending = false;
  const replyQueue = [];
  let activeRequestController = null;
  let requestGeneration = 0;

  const attachmentUrls = new Map();
  let memories = loadMemories();

  function showNotice(message) {
    noticeElement.textContent = message;
    noticeElement.hidden = false;
  }

  function hideNotice() {
    noticeElement.textContent = "";
    noticeElement.hidden = true;
  }

  function isValidMessage(message) {
    return message !== null
      && typeof message === "object"
      && typeof message.id === "string"
      && (message.sender === "user" || message.sender === "bot")
      && typeof message.text === "string"
      && typeof message.timestamp === "string"
      && /^\d{2}:\d{2}$/.test(message.timestamp);
  }

  function loadMessages() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(isValidMessage)) {
        throw new Error("O histórico salvo tem um formato inválido.");
      }
      return parsed;
    } catch (error) {
      showNotice("Não foi possível carregar o histórico salvo. Uma nova conversa será iniciada.");
      console.error("Falha ao carregar o histórico do chat:", error);
      return [];
    }
  }

  function saveMessages() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      hideNotice();
    } catch (error) {
      showNotice("Não foi possível salvar o histórico neste dispositivo.");
      console.error("Falha ao salvar o histórico do chat:", error);
    }
  }

  function normalizeMemoryText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  }

  function loadMemories() {
    try {
      const stored = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (stored === null) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.some((item) =>
        !item || typeof item.id !== "string" || typeof item.text !== "string"
      )) {
        throw new Error("O formato das memórias salvas é inválido.");
      }
      return parsed.slice(-50);
    } catch (error) {
      showNotice("Não foi possível ler as memórias deste navegador.");
      console.error("Falha ao carregar a memória da Nora:", error);
      return [];
    }
  }

  function saveMemories() {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
      renderMemories();
      return true;
    } catch (error) {
      showNotice("Não foi possível salvar a memória neste navegador.");
      console.error("Falha ao salvar a memória da Nora:", error);
      return false;
    }
  }

  function renderMemories() {
    memoryCount.textContent = String(memories.length);
    memoryList.replaceChildren();

    if (memories.length === 0) {
      const empty = document.createElement("p");
      empty.className = "memory-empty";
      empty.textContent = "Ainda não há memórias guardadas. Você pode pedir “lembre que...” no chat ou adicionar uma acima.";
      memoryList.append(empty);
      return;
    }

    for (const memory of memories) {
      const item = document.createElement("article");
      item.className = "memory-item";
      const text = document.createElement("p");
      text.textContent = memory.text;
      const remove = document.createElement("button");
      remove.className = "memory-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Apagar memória: ${memory.text}`);
      remove.addEventListener("click", () => {
        memories = memories.filter((saved) => saved.id !== memory.id);
        saveMemories();
      });
      item.append(text, remove);
      memoryList.append(item);
    }
  }

  function rememberFact(text) {
    const fact = text.trim().slice(0, 300);
    if (!fact) return false;
    if (memories.some((memory) => normalizeMemoryText(memory.text) === normalizeMemoryText(fact))) {
      return "duplicate";
    }
    if (memories.length >= 50) {
      showNotice("A memória está cheia. Apague alguma lembrança antes de adicionar outra.");
      return false;
    }
    memories.push({ id: createId(), text: fact });
    return saveMemories();
  }

  function extractMemoryFact(text) {
    const explicit = text.match(/^(?:lembre(?:-se)?(?:\s+de)?(?:\s+que)?|guarde(?:\s+que)?|anote(?:\s+que)?)\s+(.+)$/i);
    if (explicit) return explicit[1].replace(/[.!?]+$/g, "").trim();

    const patterns = [
      [/^meu nome (?:é|e)\s+(.+)$/i, (value) => `O nome da pessoa é ${value}.`],
      [/^me chamo\s+(.+)$/i, (value) => `O nome da pessoa é ${value}.`],
      [/^(?:eu )?prefiro\s+(.+)$/i, (value) => `Prefere ${value}.`],
      [/^(?:eu )?gosto (?:muito )?de\s+(.+)$/i, (value) => `Gosta de ${value}.`],
      [/^trabalho com\s+(.+)$/i, (value) => `Trabalha com ${value}.`],
      [/^estou aprendendo\s+(.+)$/i, (value) => `Está aprendendo ${value}.`],
      [/^meu objetivo é\s+(.+)$/i, (value) => `Seu objetivo é ${value}.`],
    ];
    for (const [pattern, format] of patterns) {
      const match = text.match(pattern);
      if (match) return format(match[1].replace(/[.!?]+$/g, "").trim());
    }
    return null;
  }

  function answerMemoryQuestion() {
    if (memories.length === 0) {
      return "Ainda não guardei nada sobre você. Se quiser, diga “lembre que...” ou abra Memória para adicionar algo. Você pode apagar essas lembranças quando quiser.";
    }
    return `Estas são as coisas que você me pediu para guardar:\n${memories.map((memory) => `• ${memory.text}`).join("\n")}\n\nElas ficam salvas neste navegador; você pode revisar ou apagar em Memória.`;
  }

  function forgetMemories(text) {
    const normalized = normalizeMemoryText(text);
    const forgetAll = /\b(tudo|todas|todas as memorias|tudo que sabe|tudo sobre mim)\b/.test(normalized);
    if (forgetAll) {
      const count = memories.length;
      memories = [];
      const saved = saveMemories();
      return !saved
        ? "Não consegui apagar as memórias do navegador. Confira as permissões de armazenamento e tente novamente."
        : count > 0
        ? "Pronto, apaguei todas as memórias salvas. O histórico do chat continua separado — use o botão de limpar conversa se quiser apagá-lo também."
        : "Não havia memórias salvas para apagar. O histórico do chat continua separado.";
    }

    const match = normalized.match(/(?:esqueca|esquece|apague|remova|delete)(?:\s+(?:a|o|que))?\s+(?:memoria\s+(?:de\s+)?)?(.+)/);
    let query = match ? match[1].trim() : "";
    query = query
      .replace(/^que\s+(?:eu\s+)?/, "")
      .replace(/^eu\s+prefiro\s+/, "prefere ")
      .replace(/^prefiro\s+/, "prefere ")
      .replace(/^eu\s+gosto\s+de\s+/, "gosta de ")
      .replace(/^gosto\s+de\s+/, "gosta de ")
      .replace(/[.!?]+$/g, "")
      .trim();
    if (!query) return "O que você quer que eu esqueça? Você também pode apagar lembranças individualmente em Memória.";
    const previousCount = memories.length;
    memories = memories.filter((memory) => !normalizeMemoryText(memory.text).includes(query));
    if (memories.length === previousCount) {
      return "Não encontrei uma memória com esse conteúdo. Você pode revisar todas em Memória.";
    }
    if (!saveMemories()) {
      return "Não consegui atualizar as memórias do navegador. Confira as permissões de armazenamento e tente novamente.";
    }
    return "Entendido — apaguei a memória correspondente.";
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function createMessage(sender, text) {
    return {
      id: createId(),
      sender,
      text,
      timestamp: new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    };
  }

  function renderMessage(message) {
    const row = document.createElement("article");
    row.className = `message-row ${message.sender}`;
    row.dataset.messageId = message.id;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("time");
    time.textContent = message.timestamp;
    time.setAttribute("datetime", message.timestamp);
    meta.append(time);

    if (message.sender === "user") {
      const check = document.createElement("span");
      check.className = "message-check";
      check.setAttribute("aria-label", "Enviada");
      check.textContent = "✓";
      meta.append(check);
    }

    const stack = document.createElement("div");
    stack.className = "message-stack";
    stack.append(bubble, meta);

    const attachmentUrl = attachmentUrls.get(message.id);
    if (message.sender === "bot" && attachmentUrl) {
      const link = document.createElement("a");
      link.className = "attachment-link";
      link.href = attachmentUrl.url;
      link.download = attachmentUrl.fileName;
      link.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.75v9m0 0 3.25-3.25M10 11.75 6.75 8.5M4 13.75v2A1.25 1.25 0 0 0 5.25 17h9.5A1.25 1.25 0 0 0 16 15.75v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const label = document.createElement("span");
      label.textContent = `Baixar PowerPoint · ${attachmentUrl.slideCount} slides`;
      link.append(label);
      stack.append(link);
    }

    if (message.sender === "bot") {
      const avatar = document.createElement("img");
      avatar.className = "message-avatar";
      avatar.src = "assets/nora-avatar.svg";
      avatar.alt = "";
      row.append(avatar, stack);
    } else {
      row.append(stack);
    }
    messagesElement.append(row);
  }

  function renderHistory() {
    messagesElement.replaceChildren();
    for (const message of messages) renderMessage(message);
    welcomeElement.hidden = messages.length > 0;
    scrollToBottom();
  }

  function scrollToBottom() {
    chatContent.scrollTop = chatContent.scrollHeight;
  }

  function updateComposer() {
    sendButton.disabled = input.value.trim().length === 0;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function addMessage(message) {
    messages.push(message);
    renderMessage(message);
    welcomeElement.hidden = true;
    saveMessages();
    scrollToBottom();
    return message;
  }

  function getConversationContext(throughMessageId) {
    const lastMessageIndex = throughMessageId
      ? messages.findIndex((message) => message.id === throughMessageId)
      : -1;
    const availableMessages = lastMessageIndex >= 0
      ? messages.slice(0, lastMessageIndex + 1)
      : messages;
    return availableMessages.slice(-30).map((message) => ({
      role: message.sender === "bot" ? "assistant" : "user",
      content: message.text,
    }));
  }

  function isPresentationRequest(text) {
    return /\b(slides?|powerpoint|pptx|apresenta(?:cao|ção|coes|ções))\b/i.test(text)
      && /\b(crie|criar|gere|gerar|mont[ae]|monte|prepare|preparar|faz|fa[cç]a|fazer|apresenta[cç][aã]o)\b/i.test(text);
  }

  async function sendToAssistant(request, signal) {
    const response = await fetch(request.presentation ? "/api/presentation" : "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
    if (!response.ok) {
      throw new Error(result.error || `A solicitação falhou (${response.status}).`);
    }
    return result;
  }

  function sendMessage(text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    hideNotice();
    const userMessage = addMessage(createMessage("user", cleanText));
    input.value = "";
    input.focus();
    updateComposer();
    const presentation = isPresentationRequest(cleanText);
    const normalized = normalizeMemoryText(cleanText);

    if (/\b(o que voce lembra de mim|o que voce sabe sobre mim|o que lembra sobre mim|quais sao minhas preferencias)\b/.test(normalized)) {
      addMessage(createMessage("bot", answerMemoryQuestion()));
      return;
    }

    if (/^(?:esqueca|esquece|apague|remova|delete)\b/.test(normalized)) {
      addMessage(createMessage("bot", forgetMemories(cleanText)));
      return;
    }

    const fact = extractMemoryFact(cleanText);
    if (fact) {
      const result = rememberFact(fact);
      const reply = result === "duplicate"
        ? `Já tinha guardado isso: “${fact}”. Você pode revisar minhas memórias no botão Memória.`
        : result
          ? `Anotado — vou guardar isso para nossas próximas conversas: “${fact}”. Você pode revisar ou apagar em Memória.`
          : "Não consegui guardar isso no navegador. Você pode tentar novamente ou adicionar a lembrança pelo painel Memória.";
      addMessage(createMessage("bot", reply));
      return;
    }

    replyQueue.push({
      provider: providerSelect.value,
      presentation,
      messageId: userMessage.id,
    });
    if (replyPending) return;

    processReplyQueue();
  }

  async function processReplyQueue() {
    const generation = requestGeneration;
    const request = replyQueue.shift();
    if (!request) {
      replyPending = false;
      typingElement.hidden = true;
      typingElement.setAttribute("aria-label", "Nora está digitando");
      updateComposer();
      return;
    }

    replyPending = true;
    typingElement.setAttribute("aria-label", request.presentation
      ? "Nora está criando sua apresentação"
      : "Nora está digitando");
    typingElement.querySelector(".typing-label").textContent = request.presentation
      ? "Nora está criando seus slides"
      : "Nora está pensando";
    typingElement.hidden = false;
    scrollToBottom();

    const controller = new AbortController();
    activeRequestController = controller;
    try {
      const result = await sendToAssistant({
        provider: request.provider,
        history: getConversationContext(request.messageId),
        memories: memories.map((memory) => memory.text),
        presentation: request.presentation,
      }, controller.signal);
      if (generation !== requestGeneration) return;
      const assistantMessage = createMessage("bot", result.text);

      if (result.presentation) {
        const binary = Uint8Array.from(atob(result.presentation.content), (char) => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([binary], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }));
        attachmentUrls.set(assistantMessage.id, {
          url,
          fileName: result.presentation.fileName,
          slideCount: result.presentation.slideCount,
        });
      }

      addMessage(assistantMessage);
    } catch (error) {
      if (generation === requestGeneration && error.name !== "AbortError") {
        showNotice(error.message || "Não foi possível obter uma resposta da IA.");
      }
    } finally {
      if (generation === requestGeneration) {
        activeRequestController = null;
        typingElement.hidden = true;
        processReplyQueue();
      }
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("input", updateComposer);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  clearButton.addEventListener("click", () => {
    requestGeneration += 1;
    if (activeRequestController) activeRequestController.abort();
    activeRequestController = null;
    replyQueue.length = 0;
    replyPending = false;
    typingElement.hidden = true;
    for (const attachment of attachmentUrls.values()) URL.revokeObjectURL(attachment.url);
    attachmentUrls.clear();
    messages = [];
    renderHistory();
    saveMessages();
    input.value = "";
    updateComposer();
    input.focus();
  });

  memoryButton.addEventListener("click", () => {
    renderMemories();
    memoryDialog.showModal();
    memoryInput.focus();
  });

  document.querySelector("#close-memory").addEventListener("click", () => memoryDialog.close());
  document.querySelector("#close-memory-footer").addEventListener("click", () => memoryDialog.close());

  memoryDialog.addEventListener("click", (event) => {
    if (event.target === memoryDialog) memoryDialog.close();
  });

  memoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fact = memoryInput.value.trim();
    if (!fact) return;
    const result = rememberFact(fact);
    if (result === "duplicate") {
      showNotice("Essa memória já está salva.");
      return;
    }
    if (result) {
      memoryInput.value = "";
      memoryInput.focus();
    }
  });

  document.querySelector("#forget-all").addEventListener("click", () => {
    if (!window.confirm("Apagar permanentemente todas as memórias salvas neste navegador?")) return;
    memories = [];
    if (saveMemories()) memoryInput.value = "";
  });

  window.addEventListener("storage", (event) => {
    if (event.key === MEMORY_STORAGE_KEY) {
      memories = loadMemories();
      renderMemories();
    }
  });

  for (const suggestion of suggestions) {
    suggestion.addEventListener("click", () => {
      if (suggestion.dataset.compose === "true") {
        input.value = suggestion.dataset.prompt || "";
        updateComposer();
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      sendMessage(suggestion.dataset.prompt || "");
    });
  }

  providerSelect.addEventListener("change", () => {
    try {
      localStorage.setItem("nora-provider", providerSelect.value);
    } catch (error) {
      showNotice("A preferência de modelo não pôde ser salva neste navegador.");
      console.error("Falha ao salvar o provedor selecionado:", error);
    }
  });

  async function initializeProviderStatus() {
    try {
      const response = await fetch("/api/status");
      if (!response.ok) throw new Error("Status do servidor indisponível.");
      const status = await response.json();
      connectionStatus.textContent = status.openai && status.anthropic
        ? "OpenAI + Claude prontos"
        : status.openai
          ? "OpenAI pronta"
          : status.anthropic
            ? "Claude pronto"
            : "Configure as chaves de API";
      statusDot.classList.toggle("status-offline", !status.openai && !status.anthropic);
      if (!status.openai && !status.anthropic) {
        showNotice("Configure OPENAI_API_KEY e/ou ANTHROPIC_API_KEY no terminal para ativar as respostas da IA. As chaves não são armazenadas no navegador.");
      }
    } catch (error) {
      connectionStatus.textContent = "Servidor da IA indisponível";
      statusDot.classList.add("status-offline");
      showNotice("Não consegui conectar ao servidor da Nora. Inicie-o com python server.py.");
    }
  }

  try {
    const storedProvider = localStorage.getItem("nora-provider");
    if (storedProvider === "openai" || storedProvider === "anthropic") {
      providerSelect.value = storedProvider;
    }
  } catch (error) {
    console.error("Não foi possível ler as preferências do navegador:", error);
  }

  renderHistory();
  renderMemories();
  updateComposer();
  initializeProviderStatus();
})();
