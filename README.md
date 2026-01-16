# Felinoterapia (PWA)

Aplicativo PWA offline-first para criar uma rotina leve de bem-estar com seu gato. O app é 100% local, sem login, sem coleta de dados pessoais e instalável em iOS/Android via “Adicionar à Tela Inicial”.

## Stack

- HTML, CSS e JavaScript (100% estático)
- IndexedDB para persistência local
- Service Worker + Cache Storage
- Web App Manifest com ícones

## Como rodar localmente

Como é um projeto estático, basta servir a pasta com qualquer servidor local:

```bash
python -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Deploy recomendado (Vercel)

1. Suba este repositório no GitHub.
2. No painel da Vercel, crie um novo projeto a partir do repositório.
3. Selecione **Framework: Other** (projeto estático).
4. Configure o domínio `felinoterapia.com.br`:
   - Adicione o domínio na Vercel.
   - Aponte o DNS do domínio para a Vercel (A/CNAME conforme instruções do painel).
5. Garanta HTTPS ativo (automático na Vercel).

URL final esperada: `https://felinoterapia.com.br/app/`

## Estrutura de pastas

- `/index.html`: landing page
- `/app/`: telas do app (Plano, Biblioteca, Progresso, Config)
- `/src/data/atividades.json`: banco offline de atividades
- `/sw.js`: service worker
- `/manifest.webmanifest`: manifesto PWA

## Checklist de testes (preenchido)

### iPhone (Safari)
- [ ] Abre `/app/`
- [ ] “Adicionar à Tela de Início” cria ícone
- [ ] Ao abrir pelo ícone:
  - [ ] abre em modo standalone
  - [ ] navegação funciona
  - [ ] dados persistem ao fechar e abrir
- [ ] Offline: modo avião + abrir pelo ícone (shell + dados)

### Android (Chrome)
- [ ] Banner “Instalar app” ou menu “Instalar”
- [ ] Abre em standalone
- [ ] Offline funciona
- [ ] Persistência ok

### Desktop
- [ ] Funciona no Chrome/Edge
- [ ] Lighthouse PWA sem erros críticos

> Observação: a lista acima deve ser validada no ambiente final e marcada após os testes reais.

## Privacidade

- Sem analytics
- Sem cookies de rastreamento
- Sem coleta de dados
- Tudo salvo apenas no dispositivo do usuário
