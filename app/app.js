const DB_NAME = "felinoterapia";
const DB_VERSION = 1;
const STORE_SETTINGS = "settings";
const STORE_PLANS = "dailyPlans";
const STORE_COMPLETION = "dailyCompletion";
const SETTINGS_KEY = "settings";
const DATA_URL = "/src/data/atividades.json";

const DEFAULT_SETTINGS = {
  tempoDisponivel: 10,
  nivelGato: "moderado",
  idadeGato: "adulto"
};

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PLANS)) {
        db.createObjectStore(STORE_PLANS, { keyPath: "date" });
      }
      if (!db.objectStoreNames.contains(STORE_COMPLETION)) {
        db.createObjectStore(STORE_COMPLETION, { keyPath: "date" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function salvarRegistro(storeName, value) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function buscarRegistro(storeName, key) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function buscarTodos(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function ontemISO() {
  const data = new Date();
  data.setDate(data.getDate() - 1);
  return data.toISOString().slice(0, 10);
}

function formatarDuracao(minutos) {
  return `${minutos} min`;
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function atendePreferencias(atividade, settings) {
  const tempo = Number(settings.tempoDisponivel || 10);
  const tempoOk = atividade.duracao_min <= tempo || tempo === 15;

  const nivel = settings.nivelGato || "moderado";
  const nivelOk =
    (nivel === "calmo" && atividade.nivel <= 2) ||
    (nivel === "moderado" && atividade.nivel >= 1) ||
    (nivel === "ativo" && atividade.nivel >= 2);

  const idade = settings.idadeGato || "adulto";
  const idadeOk =
    (idade === "filhote" && atividade.nivel <= 2) ||
    (idade === "adulto" && atividade.nivel >= 1) ||
    (idade === "senior" && atividade.nivel <= 2);

  return tempoOk && nivelOk && idadeOk;
}

async function carregarAtividades() {
  const response = await fetch(DATA_URL);
  return response.json();
}

async function obterSettings() {
  const registro = await buscarRegistro(STORE_SETTINGS, SETTINGS_KEY);
  return registro?.value ? { ...DEFAULT_SETTINGS, ...registro.value } : DEFAULT_SETTINGS;
}

async function salvarSettings(settings) {
  await salvarRegistro(STORE_SETTINGS, { id: SETTINGS_KEY, value: settings });
}

async function obterPlanoDoDia(atividades, settings) {
  const data = hojeISO();
  const existente = await buscarRegistro(STORE_PLANS, data);
  if (existente) {
    return existente;
  }

  const ontem = await buscarRegistro(STORE_PLANS, ontemISO());
  const idsOntem = new Set(ontem?.itens?.map((item) => item.id) || []);

  const categorias = ["brincadeira", "enriquecimento", "cuidado"];
  const itens = categorias.map((categoria) => {
    const filtradas = atividades.filter(
      (atividade) =>
        atividade.categoria === categoria && atendePreferencias(atividade, settings)
    );
    const semRepeticao = filtradas.filter((atividade) => !idsOntem.has(atividade.id));
    const candidatas = semRepeticao.length ? semRepeticao : filtradas;
    const escolha = embaralhar(candidatas)[0] || atividades.find((a) => a.categoria === categoria);
    return escolha;
  });

  const plano = { date: data, itens };
  await salvarRegistro(STORE_PLANS, plano);
  return plano;
}

async function obterConclusoes() {
  return buscarTodos(STORE_COMPLETION);
}

async function obterConclusaoDoDia() {
  const data = hojeISO();
  const registro = await buscarRegistro(STORE_COMPLETION, data);
  return registro || { date: data, itens: {} };
}

async function atualizarConclusao(id, feito) {
  const registro = await obterConclusaoDoDia();
  registro.itens[id] = feito;
  await salvarRegistro(STORE_COMPLETION, registro);
  return registro;
}

function calcularStreak(conclusoes) {
  const datasOrdenadas = conclusoes
    .filter((registro) => Object.values(registro.itens || {}).every(Boolean))
    .map((registro) => registro.date)
    .sort();

  let streak = 0;
  let dataAtual = hojeISO();

  while (datasOrdenadas.includes(dataAtual)) {
    streak += 1;
    const data = new Date(dataAtual);
    data.setDate(data.getDate() - 1);
    dataAtual = data.toISOString().slice(0, 10);
  }

  return streak;
}

function calcularScoreSemana(conclusoes) {
  const hoje = new Date();
  const seteDias = new Date();
  seteDias.setDate(hoje.getDate() - 6);
  return conclusoes.reduce((total, registro) => {
    const dataRegistro = new Date(registro.date);
    if (dataRegistro >= seteDias && dataRegistro <= hoje) {
      return total + Object.values(registro.itens || {}).filter(Boolean).length;
    }
    return total;
  }, 0);
}

function calcularScoreMes(conclusoes) {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return conclusoes.reduce((total, registro) => {
    const dataRegistro = new Date(registro.date);
    if (dataRegistro >= inicioMes && dataRegistro <= hoje) {
      return total + Object.values(registro.itens || {}).filter(Boolean).length;
    }
    return total;
  }, 0);
}

function calcularTotal(conclusoes) {
  return conclusoes.reduce(
    (total, registro) => total + Object.values(registro.itens || {}).filter(Boolean).length,
    0
  );
}

function formatarDataCurta(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}

function criarTimer(duracaoMinutos, elemento) {
  let restante = duracaoMinutos * 60;
  let intervalo = null;

  const atualizar = () => {
    const minutos = String(Math.floor(restante / 60)).padStart(2, "0");
    const segundos = String(restante % 60).padStart(2, "0");
    elemento.textContent = `${minutos}:${segundos}`;
  };

  const iniciar = () => {
    if (intervalo) return;
    intervalo = setInterval(() => {
      if (restante > 0) {
        restante -= 1;
        atualizar();
      } else {
        clearInterval(intervalo);
        intervalo = null;
      }
    }, 1000);
  };

  const pausar = () => {
    clearInterval(intervalo);
    intervalo = null;
  };

  const resetar = () => {
    pausar();
    restante = duracaoMinutos * 60;
    atualizar();
  };

  atualizar();
  return { iniciar, pausar, resetar };
}

async function renderizarPlano() {
  const container = document.getElementById("plano-diario");
  if (!container) return;

  const [settings, atividades, conclusoes] = await Promise.all([
    obterSettings(),
    carregarAtividades(),
    obterConclusoes()
  ]);

  const plano = await obterPlanoDoDia(atividades, settings);
  const conclusaoDia = await obterConclusaoDoDia();

  container.innerHTML = "";

  plano.itens.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card list__item";

    const header = document.createElement("div");
    header.innerHTML = `
      <span class="badge">${item.categoria}</span>
      <h3>${item.titulo}</h3>
      <p>${item.descricao_curta}</p>
    `;

    const timerWrapper = document.createElement("div");
    timerWrapper.className = "timer";

    const timeDisplay = document.createElement("span");
    timeDisplay.className = "timer__time";

    const timer = criarTimer(item.duracao_min, timeDisplay);

    const botaoIniciar = document.createElement("button");
    botaoIniciar.className = "button";
    botaoIniciar.textContent = "Iniciar";
    botaoIniciar.addEventListener("click", timer.iniciar);

    const botaoPausar = document.createElement("button");
    botaoPausar.className = "button button--light";
    botaoPausar.textContent = "Pausar";
    botaoPausar.addEventListener("click", timer.pausar);

    const botaoResetar = document.createElement("button");
    botaoResetar.className = "button button--light";
    botaoResetar.textContent = "Reset";
    botaoResetar.addEventListener("click", timer.resetar);

    timerWrapper.append(timeDisplay, botaoIniciar, botaoPausar, botaoResetar);

    const checklist = document.createElement("div");
    checklist.className = "checklist";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(conclusaoDia.itens[item.id]);
    const span = document.createElement("span");
    span.textContent = "Concluído hoje";
    label.append(checkbox, span);

    checkbox.addEventListener("change", async (event) => {
      const atualizado = await atualizarConclusao(item.id, event.target.checked);
      atualizarResumo(atualizado, conclusoes);
    });

    checklist.append(label);

    const detalhes = document.createElement("div");
    detalhes.innerHTML = `
      <p><strong>Duração:</strong> ${formatarDuracao(item.duracao_min)}</p>
      <p><strong>Nível:</strong> ${item.nivel}</p>
      <p><strong>Passos:</strong> ${item.passos.join(" • ")}</p>
      <p><strong>Dicas:</strong> ${item.dicas.join(" • ")}</p>
    `;

    card.append(header, timerWrapper, checklist, detalhes);
    container.append(card);
  });

  atualizarResumo(conclusaoDia, conclusoes);
}

function atualizarResumo(conclusaoDia, concluidos) {
  const combinados = concluidos
    .filter((registro) => registro.date !== conclusaoDia.date)
    .concat(conclusaoDia);

  const streak = calcularStreak(combinados);
  const scoreSemana = calcularScoreSemana(combinados);

  const streakEl = document.getElementById("streak-dias");
  const scoreEl = document.getElementById("score-semanal");
  if (streakEl) streakEl.textContent = String(streak);
  if (scoreEl) scoreEl.textContent = String(scoreSemana);
}

async function renderizarBiblioteca() {
  const container = document.getElementById("biblioteca-lista");
  if (!container) return;

  const atividades = await carregarAtividades();
  container.innerHTML = "";

  atividades.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card list__item";
    card.innerHTML = `
      <span class="badge">${item.categoria}</span>
      <h3>${item.titulo}</h3>
      <p>${item.descricao_curta}</p>
      <p><strong>Duração:</strong> ${formatarDuracao(item.duracao_min)} · <strong>Nível:</strong> ${item.nivel}</p>
      <p><strong>Passos:</strong> ${item.passos.join(" • ")}</p>
      <p><strong>Sinais de que deu certo:</strong> ${item.sinais_de_que_deu_certo.join(" • ")}</p>
      <p><strong>Alertas:</strong> ${item.alertas.join(" • ")}</p>
    `;
    container.append(card);
  });
}

async function renderizarProgresso() {
  const container = document.getElementById("progresso-resumo");
  if (!container) return;

  const conclusoes = await obterConclusoes();
  const streak = calcularStreak(conclusoes);
  const semana = calcularScoreSemana(conclusoes);
  const mes = calcularScoreMes(conclusoes);
  const total = calcularTotal(conclusoes);

  const streakEl = document.getElementById("progresso-streak");
  const semanaEl = document.getElementById("progresso-semana");
  const mesEl = document.getElementById("progresso-mes");
  const totalEl = document.getElementById("progresso-total");

  if (streakEl) streakEl.textContent = String(streak);
  if (semanaEl) semanaEl.textContent = String(semana);
  if (mesEl) mesEl.textContent = String(mes);
  if (totalEl) totalEl.textContent = String(total);

  const historico = document.getElementById("progresso-historico");
  if (historico) {
    const ordenadas = conclusoes
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 7);

    historico.innerHTML = "";
    ordenadas.forEach((registro) => {
      const card = document.createElement("div");
      card.className = "card";
      const feitos = Object.values(registro.itens || {}).filter(Boolean).length;
      card.innerHTML = `
        <h3>${formatarDataCurta(registro.date)}</h3>
        <p>${feitos} itens concluídos</p>
      `;
      historico.append(card);
    });
  }
}

async function configurarPreferencias() {
  const form = document.getElementById("config-form");
  if (!form) return;

  const settings = await obterSettings();
  const tempoSelect = document.getElementById("tempo-disponivel");
  const nivelSelect = document.getElementById("nivel-gato");
  const idadeSelect = document.getElementById("idade-gato");

  if (tempoSelect) tempoSelect.value = String(settings.tempoDisponivel);
  if (nivelSelect) nivelSelect.value = settings.nivelGato;
  if (idadeSelect) idadeSelect.value = settings.idadeGato;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const novosSettings = {
      tempoDisponivel: Number(tempoSelect.value),
      nivelGato: nivelSelect.value,
      idadeGato: idadeSelect.value
    };
    await salvarSettings(novosSettings);
    window.alert("Preferências salvas! O plano do dia será atualizado amanhã.");
  });
}

renderizarPlano();
renderizarBiblioteca();
renderizarProgresso();
configurarPreferencias();
