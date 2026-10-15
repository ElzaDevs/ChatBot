# Visão Geral

Esta especificação define os requisitos funcionais, visuais e comportamentais da Nora: frontend leve em HTML5, CSS3 e JavaScript Vanilla, com backend Python local para conectar provedores de IA e exportar arquivos PowerPoint.

# Requisitos Tecnológicos e Restrições

- Linguagens: HTML5, CSS3, JavaScript (ES6+ Vanilla) e Python 3.

- Dependências do frontend: Nenhuma (sem React, Vue, Tailwind, jQuery, fontes ou recursos remotos).

- Dependência Python: python-pptx para gerar apresentações PowerPoint.

- Integrações de IA: APIs OpenAI e Anthropic, habilitadas por chaves de ambiente e conexão à internet.

- Compatibilidade: Navegadores modernos (Chrome, Firefox, Edge, Safari).

- Armazenamento Local: localStorage para persistência básica de histórico de mensagens na sessão do usuário.

- Memória duradoura: fatos e preferências explicitamente guardados pela pessoa usuária, persistidos no localStorage e gerenciáveis pelo painel Memória.

# Arquitetura de Arquivos

A estrutura do projeto deve conter os seguintes arquivos, agrupados por responsabilidade:

- index.html: Estrutura semântica do chat
- css/style.css: Estilização completa e Design Tokens
- js/script.js: Lógica do chat, estado e manipulação do DOM
- server.py: Backend local, proxy seguro para os modelos e geração de apresentações
- requirements.txt: Dependências Python do backend
- assets/nora.svg: Favicon vetorial da Nora
- assets/nora-avatar.svg: Retrato ilustrado da Nora usado no cabeçalho e nas respostas

## Executar localmente

No Windows, crie `.venv` com `py -3 -m venv .venv`, instale `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`, configure `OPENAI_API_KEY` e/ou `ANTHROPIC_API_KEY` no ambiente e inicie com `.\.venv\Scripts\python.exe server.py`. O backend serve a interface em `http://127.0.0.1:8000`; as chaves não devem ser expostas no navegador.

O histórico é persistido no `localStorage`. Até 30 mensagens recentes da conversa são enviadas como contexto ao provedor selecionado. Solicitações para gerar apresentações retornam um arquivo `.pptx`.

Memórias duradouras podem ser registradas por comandos como “lembre que...”, “meu nome é...” e “prefiro...”, ou pelo painel Memória. A pessoa usuária pode consultá-las, adicionar, remover individualmente ou apagar todas. As memórias e as últimas 30 mensagens são enviadas como contexto ao provedor selecionado. Limpar o histórico da conversa não apaga as memórias.

# Requisitos Funcionais

## Exibição de Mensagens

- Lista de Mensagens: O chat deve exibir mensagens enviadas pelo usuário e respostas geradas pelo bot.

## Identificação Visual

- Mensagens do Usuário: Alinhadas à direita, fundo pink com cor de destaque.

- Mensagens do Bot: Alinhadas à esquerda, fundo neutro escuro/cinza.

- Carimbo de Hora (Timestamp): Cada mensagem deve exibir o horário de envio no formato HH:MM.

## Envio de Mensagens

### Formas de Envio

- Clique no botão de "Enviar".

- Pressionar a tecla Enter com o campo de texto focado.

- Shift + Enter deve permitir a quebra de linha sem enviar a mensagem.

- Validação: Não deve ser possível enviar mensagens vazias ou compostas apenas por espaços em branco.

- Limpeza do Campo: Após o envio, o campo de texto deve ser limpo e focado novamente.

## Indicador de Digitação (Typing Indicator)

Enquanto o bot aguarda ou gera uma resposta, a interface deve exibir um indicador visual de "digitando..." (animação simples com três pontos pulsantes).

## Scroll Automático

Sempre que uma nova mensagem for adicionada (ou o indicador de digitação for exibido), a área de mensagens deve rolar automaticamente para a parte inferior (scrollTop = scrollHeight).

## Limpeza de Histórico

Deve haver um botão no cabeçalho do chat para limpar as mensagens da tela e do localStorage.

# Lógica de Negócio e Estados (JavaScript)

## Estrutura do Estado da Mensagem

As mensagens devem ser tratadas como objetos com o seguinte formato:

{
  "id": "string-uuid-ou-timestamp",
  "sender": "user" | "bot",
  "text": "Conteúdo da mensagem",
  "timestamp": "14:32"
}

## Fluxo da Resposta do Bot (assistente local)

- O usuário envia uma mensagem.

- O sistema exibe a mensagem do usuário no DOM e salva no estado.

- Exibe o indicador de digitação do bot.

- Exibe um indicador animado enquanto aguarda a resposta real do provedor selecionado.

- Mantém até 30 mensagens recentes como contexto da conversa, armazenada no localStorage e enviada ao provedor escolhido para gerar respostas.

- As chaves de API permanecem no ambiente do backend e nunca são enviadas ao navegador.

- Solicitações explícitas de apresentações devem gerar slides e disponibilizar um arquivo `.pptx` editável para download.

- Erros de configuração, conectividade e resposta dos provedores devem ser exibidos claramente na interface.

- Atualiza o localStorage.

# Critérios de Aceite e Qualidade

## Acessibilidade básica

- O campo de texto deve conter aria-label="Digite sua mensagem".

- Elementos interativos devem ser navegáveis via tecla Tab.

## Robustez

O layout não deve quebrar com textos muito longos (usar word-break: break-word).

## Desempenho

O frontend não carrega bibliotecas, fontes ou imagens de servidores externos. Chamadas aos provedores externos acontecem apenas ao enviar uma mensagem. O carregamento inicial da página deve ocorrer em menos de 100ms em condições locais normais.
