# Persona Companion para Windows

Overlay somente leitura do **Meu plano de hoje**, em Tauri 2. A PWA continua
responsável pelo cadastro, planejamento, conclusão, recorrências e gravação do
banco. Não é necessário deixar o navegador aberto para o companion ler o JSON
ou enviar o resumo. O processo do companion precisa continuar rodando.

## Gerar ou baixar o instalador

1. Envie estas alterações ao GitHub. Em **Actions → Windows companion installer
   → Run workflow**, selecione a branch e execute o workflow manual.
2. Quando o job terminar, abra **Artifacts** e baixe
   `Persona-Companion-Windows-<número>`. Extraia o ZIP e execute o `*-setup.exe`.
   Os artefatos ficam disponíveis por 14 dias e seu download exige acesso ao
   repositório. Não há publicação automática de Release.
3. Para distribuir permanentemente: crie uma tag, por exemplo
   `companion-v0.1.0`, abra **Releases → Draft a new release**, escolha a tag,
   anexe **somente o instalador** extraído do artefato da mesma revisão,
   descreva as alterações e publique a Release. O instalador passa a aparecer
   em **Releases → Assets**. Para outra versão, atualize as versões do
   `package.json`, `Cargo.toml`, `tauri.conf.json` e os lockfiles antes do build.

O workflow está em [windows-companion.yml](../.github/workflows/windows-companion.yml).
O build padrão gera NSIS para o usuário atual, sem exigir instalação por máquina.
Não há certificado de assinatura configurado; o Windows pode apresentar
SmartScreen. Para distribuição assinada, configure um certificado de assinatura
de código no pipeline segundo a documentação do Tauri, sem incluí-lo no Git.
O WebView2 é necessário; o instalador Tauri usa o bootstrapper padrão para
instalá-lo quando faltar (pode precisar de Internet).

## Primeiro uso

1. No Chrome/Edge, abra o Persona e use **Configurações → Banco de dados
   vinculado → Criar novo banco** ou **Vincular banco existente**. Salve esse
   JSON numa pasta pessoal fora deste repositório e fora de pastas temporárias.
   Faça um backup antes de experimentar. Exportar um backup isolado não cria
   um vínculo: o web precisa estar vinculado para gravar futuras alterações.
2. Instale e abra **Persona Companion**. Em **Ajustes → Selecionar banco JSON**,
   selecione **o mesmo arquivo**. O companion pede acesso próprio ao arquivo;
   não consegue descobrir automaticamente o handle privado do navegador.
3. Informe a URL onde você usa o Persona, como `https://seu-site/persona/`
   ou `http://localhost:8000/` se mantiver um servidor local. Clique em
   **Salvar ajustes**. **Abrir Persona** abre essa URL com `#today` no navegador
   padrão. Para URL local, o servidor web precisa estar ativo. O companion
   continua funcionando sem esse servidor. O fluxo existente de instalação
   da PWA permanece disponível no Chrome/Edge.
4. Escolha **Sempre no topo**, habilite **Resumo diário** e defina o horário
   local. **Iniciar com o Windows** habilita/desabilita a entrada do aplicativo
   no login do usuário, independentemente do botão Salvar.

Arraste pela marca PERSONA. Use `−` para recolher e `+` para expandir. O `×` e
Alt+F4 ocultam a janela, mantendo o processo na bandeja. Clique no ícone da
bandeja ou use **Abrir Hoje** no menu para reabrir; **Sair do companion** encerra
o processo e os alertas. Abrir o aplicativo novamente reaproveita a instância
existente. Posição e tamanho são restaurados pelo plugin de estado da janela.

## Regras e conexão

- As três seções espelham **Meu plano de hoje**: Manhã, Tarde e Se sobrar tempo.
  A fila automática de atenção dos próximos 30 dias não é um plano do dia e não
  é acrescentada ao overlay. A seleção, a ordenação e a duração usam
  `shared/today.js` nos dois clientes.
- Cada ação deve pertencer à data atual e estar vinculada a uma demanda que
  ainda existe. Ações concluídas continuam visíveis. Concluir uma **demanda**
  não marca suas **ações planejadas** como concluídas; o overlay mostra os dois
  estados separadamente. Recorrências são geradas pelo `complete()` do web e
  nunca pelo companion. Um novo ciclo só entra no overlay se for planejado.
- Datas do plano são datas de calendário `YYYY-MM-DD`. Os dois clientes usam
  agora o dia local, evitando a antiga troca do dia em UTC às 21h no Brasil.
  O companion recalcula a data a cada segundo, inclusive ao retomar de suspensão.
- A cada segundo o backend nativo relê o caminho selecionado, inclusive se o
  arquivo for substituído por renomeação. Não usa um watcher preso ao inode.
  JSON truncado, estrutura inválida, arquivo ausente ou erro de acesso preservam
  a última leitura válida **em memória**, com aviso de conexão. O retry é
  automático. **Ajustes → Selecionar banco JSON** permite trocar o caminho.
  Selecionar um arquivo inválido não substitui um vínculo que funcionava.
- O limite de leitura é 32 MiB. O companion não modifica, bloqueia, normaliza no
  disco, copia para o repositório ou envia o banco pela rede. Após reiniciar,
  precisa ler novamente o arquivo; não mantém uma cópia pessoal persistente.
- O resumo informa totais e pendências do plano atual. É despachado no horário
  configurado ou na primeira leitura válida após esse horário, se ainda pendente.
  Ao suspender/desligar o PC não há entrega; ao retomar há recuperação apenas do
  resumo do dia atual. Alterar o JSON ou o horário não repete o resumo já enviado.
- A data local de despacho é persistida **antes** de chamar a API de notificação,
  garantindo no máximo uma tentativa por dia, também após reiniciar ou atrasar
  o relógio. Se o processo cair entre o registro e a chamada, ou o Windows
  suprimir o toast, não há nova tentativa naquele dia. Falhas retornadas pela API
  aparecem nos Ajustes/rodapé. O sistema pode ocultar alertas com Não Perturbe.
- Não existem horários individuais no modelo atual: `period`, `dueDate`,
  `estimatedMinutes`, `actualMinutes` e o timer não são horários de alarme.
  Portanto não são inventados alertas por atividade. Uma futura extensão do
  modelo exigirá regras explícitas e testes para agendamento individual.

As preferências (caminho, URL, horário, opções e histórico de dias despachados)
ficam no diretório de configuração do aplicativo, normalmente
`%APPDATA%\com.orizon.persona.companion`. O estado da janela também fica fora do
checkout. Não compartilhe essa pasta em artefatos. O frontend de produção
contém apenas os arquivos do overlay e o módulo compartilhado; não incorpora o
checkout da PWA nem bancos de usuário. `.gitignore` ignora JSONs pessoais, com
exceções explícitas para configuração, lockfiles e fixtures sintéticas.

## Desenvolvimento e checks

A PWA continua sendo estática: na raiz execute `python3 -m http.server 8000`.
Não foi convertida em aplicação Tauri. O companion tem frontend próprio em
`companion/` e backend em `companion/src-tauri/`.

No Windows instale Node 22+, Rust estável com target MSVC e **Visual Studio
Build Tools → Desenvolvimento para desktop com C++**, incluindo Windows SDK.
Instale WebView2 se necessário. Então, na raiz:

```powershell
npm ci
npm test
cargo test --locked --manifest-path companion/src-tauri/Cargo.toml
npm run desktop:dev
# instalador:
npm run desktop:build -- --bundles nsis
```

Saída: `companion/src-tauri/target/release/bundle/nsis/*-setup.exe`.
O workflow executa os testes JS e Rust antes de gerar esse arquivo.

No Linux, o núcleo de leitura/agendamento é portátil; o desktop foi configurado
especificamente para Windows e não requer instalar GTK/WebKit para estes checks:

```sh
npm ci
npm test
npm run build
cargo test --locked --manifest-path companion/src-tauri/Cargo.toml
# precisa de Python 3 e Chromium; pode substituir o caminho:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

O teste de navegador inicia e encerra servidores próprios nas portas 8011 e
1421. Usa `tests/fixtures/today.json`, sem dados pessoais, e uma ponte Tauri
simulada. Compara a renderização real do web com o overlay, edita e conclui
uma ação no web, verifica retenção/reconexão visual, mudança de dia local,
recolhimento e os comandos de abertura. Também carrega a PWA offline. O teste
Rust exercita a leitura real de arquivo truncado, removido e recuperado e a
persistência lógica do controle diário. A ponte simulada **não** comprova a
bandeja, a entrega do toast ou o registro de autostart no Windows.

## Roteiro curto no PC Windows

Use um JSON de teste/cópia pessoal fora do checkout; nunca experimente truncar
o seu único banco real.

1. Instale o artefato do workflow. Vincule o mesmo JSON nos dois aplicativos e
   planeje ações nos três períodos. Compare ordem, texto, duração e estados.
   Edite uma demanda, conclua uma ação (informando tempo real no web), depois
   conclua uma demanda recorrente. Confira atualização em cerca de 1–2 segundos
   e que o próximo ciclo não foi planejado automaticamente.
2. Com uma cópia de teste vinculada, guarde seus bytes, escreva temporariamente
   `{` no arquivo e aguarde: a lista anterior deve continuar com aviso. Restaure
   o JSON: o aviso deve sumir e as alterações aparecer. Renomeie/remova o arquivo:
   deve avisar sem perder a lista; restaure-o ou selecione outro arquivo.
3. Configure resumo para daqui a dois minutos; salve. Feche o navegador e a
   janela do companion. Aguarde o toast; reabra pela bandeja e reinicie o
   companion. Edite o JSON e o horário: nenhum segundo resumo no mesmo dia.
   Em outro dia, abra o companion depois do horário: deve haver um resumo de
   recuperação. Não Perturbe e notificações do aplicativo devem estar habilitados
   apropriadamente no Windows para observar o teste.
4. Arraste, recolha/expanda e alterne Sempre no topo. Use `×`, Alt+F4, clique no
   ícone e **Abrir Hoje** no menu da bandeja. Use **Sair** e abra de novo: confira
   posição e opções restauradas. **Abrir Persona** deve chegar à tela Hoje.
5. Habilite iniciar com Windows, saia e faça logoff/login. O companion deve
   iniciar sem o navegador. Desabilite e repita: não deve iniciar. Deixe ligado
   durante a meia-noite local com ações para o dia seguinte e confirme a troca.

Instalação NSIS, bandeja real, notificações nativas, persistência visual da
janela entre sessões e autostart exigem este teste em Windows. O workflow gera
o instalador, mas não substitui esse teste interativo.
