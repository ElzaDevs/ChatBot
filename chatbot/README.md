# Nora

Chat com frontend HTML, CSS e JavaScript e backend Python local. É possível selecionar OpenAI ou Claude; as chaves ficam somente nas variáveis de ambiente do servidor. O histórico do navegador é salvo no `localStorage`; até 30 mensagens recentes são enviadas ao provedor selecionado como contexto. A Nora também gera arquivos PowerPoint editáveis.

## Estrutura

```text
chatbot/
├── assets/
│   ├── nora-avatar.svg
│   └── nora.svg
├── css/
│   └── style.css
├── js/
│   └── script.js
├── index.html
├── server.py
├── requirements.txt
├── design-system.md
└── spec.md
```

`index.html` monta a interface; `css/style.css` contém tokens e estilos; `js/script.js` controla estado, contexto e interações; `server.py` expõe a API, integra os provedores e cria PowerPoints; `assets/` guarda o retrato e o favicon.

## Configurar e executar no Windows

Crie o ambiente Python e instale a dependência usada para exportar apresentações:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Configure uma ou ambas as chaves no terminal onde o servidor será iniciado. O prompt seguro evita que o texto digitado apareça na tela; as chaves ficam apenas no ambiente dessa sessão:

```powershell
$openAISecret = Read-Host "Chave OpenAI (Enter para pular)" -AsSecureString
if ($openAISecret.Length -gt 0) {
  $env:OPENAI_API_KEY = (New-Object System.Net.NetworkCredential("", $openAISecret)).Password
}
$anthropicSecret = Read-Host "Chave Anthropic (Enter para pular)" -AsSecureString
if ($anthropicSecret.Length -gt 0) {
  $env:ANTHROPIC_API_KEY = (New-Object System.Net.NetworkCredential("", $anthropicSecret)).Password
}
Remove-Variable openAISecret, anthropicSecret
.\.venv\Scripts\python.exe server.py
```

As chaves são opcionais individualmente; configure pelo menos uma para conversar. Abra <http://127.0.0.1:8000>. O servidor escuta somente em `127.0.0.1` por padrão. Opcionalmente, use `OPENAI_MODEL` ou `ANTHROPIC_MODEL` para trocar os identificadores padrão de modelo. Para encerrar, pressione `Ctrl+C`.

## Recursos e privacidade

- Envie mensagens usando o botão ou Enter; Shift+Enter insere uma nova linha.
- Alterne entre OpenAI e Claude no seletor. A chave não é enviada ao navegador.
- O histórico permanece no `localStorage`; as últimas 30 mensagens são enviadas à API do provedor selecionado para manter contexto. A limpeza do chat apaga apenas o histórico da conversa; as memórias salvas continuam disponíveis até serem apagadas no painel **Memória**.
- Guarde fatos intencionalmente com “lembre que...”, “meu nome é...” ou “prefiro...”. A Nora também responde “o que você lembra de mim?” e entende pedidos para esquecer. Revise, adicione ou remova itens no painel **Memória**.
- As memórias ficam no `localStorage` deste navegador e são transmitidas ao provedor selecionado junto com a conversa. Evite armazenar senhas ou dados sensíveis.
- Peça para criar uma apresentação (por exemplo, “Crie slides sobre energia solar”) e baixe o `.pptx` editável gerado.
- O conteúdo enviado à IA sai do dispositivo para o provedor escolhido e fica sujeito às políticas desse provedor.
