# Persona para Windows — aplicativo único

A partir da versão **0.2.0**, o instalador contém o **Persona completo**, o painel
compacto de Hoje e os alertas nativos no mesmo aplicativo. Abra apenas **Persona**:
não é necessário abrir o navegador ou um companion separado.

A pasta continua se chamando `companion/` por compatibilidade com os comandos de
build. O identificador do aplicativo foi mantido para reutilizar preferências e
banco da versão anterior. A versão web/PWA continua disponível e independente.

## Versão portátil: abrir sem instalar

O workflow gera dois downloads separados. Para executar sem instalador:

1. Abra **Actions → Windows Persona (portable + installer)** e a execução mais
   recente. Alterações no workflow/empacotador iniciam uma execução automaticamente;
   também é possível usar **Run workflow** em `main`.
2. Na execução, baixe **Artifacts → Persona-Portable-Windows-<número>**. Esse é
   o ZIP portátil. O artefato **Persona-Windows-<número>** é o instalador tradicional.
3. Use **Extrair tudo** para uma pasta sua, como `Documentos\Persona`.
   Abra **Persona.exe** na pasta extraída, mantendo juntos os demais arquivos.
   Não execute diretamente de dentro do ZIP.
4. O Persona completo abre com o mesmo overlay, bandeja e configurações. Para
   mostrar o painel, clique em **Hoje na área de trabalho**. Para trazer o banco
   da PWA, selecione seu JSON em Configurações.

Esse pacote não executa instalador, não cria serviço e não solicita elevação.
Ele exige **Windows 10/11 x64 e WebView2 Runtime já disponível no PC**. O loader,
quando necessário, está incluído, mas o runtime completo não é instalado por esta
versão. Se faltar o WebView2 ou houver bloqueio corporativo de execução, será
necessário apoio da TI. Portátil não garante autorização para executar no PC.

As preferências e o banco padrão continuam na pasta de dados do usuário
(`%APPDATA%\com.orizon.persona.companion`), não junto ao executável. O banco
vinculado permanece no local escolhido. Portanto a versão é **sem instalação**,
mas copiar a pasta do executável para outro computador não leva seus dados
automaticamente. Use exportação/vínculo do JSON para isso.

Para atualizar, saia pela bandeja e extraia o novo pacote. Se habilitou **Iniciar
com o Windows**, mantenha a pasta fixa; desabilite essa opção antes de mover ou
apagar os arquivos. As notificações devem ser testadas no PC; o sistema pode
identificar o aplicativo portátil de modo diferente do instalado.

O pacote inclui apenas `Persona.exe`, `LEIA-ME.txt`, `SHA256SUMS.txt` e, quando
necessária, `WebView2Loader.dll`. Não inclui bancos ou preferências. O upload do
portátil ocorre antes do build NSIS, de modo que uma falha no instalador não
impede o download portátil já gerado.

## Instalar e trazer os dados existentes

1. No GitHub, execute **Actions → Windows Persona (portable + installer) → Run workflow** na
   branch atual. Ao concluir, baixe o artefato `Persona-Windows-<número>`, extraia
   o ZIP e execute o `*-setup.exe`. Artefatos ficam disponíveis por 14 dias.
2. Se instalou o antigo **Persona Companion 0.1**, encerre-o pela bandeja antes
   de instalar/abrir esta versão. Se ficar um atalho antigo, desinstale a versão
   antiga. Não é necessário manter os dois aplicativos. Faça backup do seu JSON.
3. Abra **Persona**. Ele já contém as telas de cadastro, planejamento, conclusão,
   calendário e configurações. No primeiro uso sem vínculo, cria um banco local
   no diretório de dados do aplicativo, fora do repositório.
4. Para trazer o banco que você usava na PWA, vá a **Configurações → Banco de
   dados vinculado → Vincular banco existente** e selecione seu JSON. Se usava
   apenas o armazenamento do navegador, exporte-o primeiro pela PWA e selecione
   o arquivo exportado no aplicativo. Os perfis de armazenamento da PWA e do
   aplicativo Windows são diferentes; não há importação automática do navegador.
   Um vínculo já configurado no antigo companion é reutilizado.

O instalador é NSIS para o usuário atual. WebView2 é necessário; o bootstrapper
padrão do Tauri pode precisar de Internet para instalá-lo. Não há certificado de
assinatura configurado, portanto o Windows pode apresentar SmartScreen.

## Uso diário

- Abra **Persona** pelo seu único atalho. Cadastre, planeje e conclua tudo na
  janela principal, sem navegador e sem servidor local.
- Use **Hoje na área de trabalho**, no topo, para abrir o painel compacto.
  Ele é uma segunda visualização **do mesmo aplicativo**, não uma instalação ou
  processo independente. Não permite editar atividades.
- O painel é translúcido: por padrão, fica com **35% de opacidade** sem o mouse
  e **97%** ao passar o cursor sobre ele. Ao retirar o mouse, volta a ficar
  discreto, com transição suave. O foco por teclado também aumenta a visibilidade;
  a preferência de reduzir animações é respeitada.
- Segure o botão esquerdo sobre o **cabeçalho PERSONA** e arraste para qualquer
  posição, inclusive no meio da tela ou em outro monitor. Os botões continuam
  funcionando sem iniciar arrasto. A posição fica salva. Na primeira abertura
  sem posição salva, o painel começa centralizado.
- Em **Ajustes → Opacidade sem o mouse**, escolha de **15% a 75%** e clique em
  **Salvar ajustes**. O percentual escolhido é lembrado ao reabrir o aplicativo.
- No painel, **Abrir Persona** traz de volta a janela principal na tela Hoje;
  não abre um endereço no navegador. Em **Ajustes**, configure horário local do
  resumo, Sempre no topo e Iniciar com o Windows.
- Fechar a janela principal a oculta e mostra o painel de Hoje. Fechar o painel
  apenas o oculta. O aplicativo continua na bandeja e envia os alertas.
- Clique no ícone da bandeja para abrir o Persona completo. O menu também permite
  mostrar o overlay. **Sair do Persona** grava alterações pendentes e encerra o
  aplicativo. Se houver falha na gravação, a janela principal avisa e permanece
  aberta para recuperar/reabrir o banco.
- Abrir o atalho novamente reutiliza a instância existente. Posição e tamanho
  das duas visualizações são restaurados separadamente.

Você pode continuar usando a versão web, se quiser, mas ela não é necessária
para usar o aplicativo Windows. Para evitar conflitos, prefira um editor por vez.

## Banco, sincronização e alertas

A janela principal grava automaticamente no JSON vinculado, usando arquivo
provisório e substituição após validação. Antes de salvar, verifica se o conteúdo
ainda corresponde à última versão lida. Se outra janela/PWA tiver alterado o
banco, recusa a gravação e pede **Reabrir / atualizar**. Essa opção descarta as
alterações locais não gravadas após confirmação; faça uma exportação se precisar
preservá-las. A detecção é otimista: não substitui uma coordenação transacional
entre editores concorrentes, por isso é recomendado usar um editor de cada vez.

O overlay continua **somente leitura**. O backend relê o caminho a cada segundo,
inclusive se o arquivo for substituído por renomeação. O editor também atualiza
mudanças externas quando não há alterações locais pendentes. JSON inválido,
gravação incompleta, arquivo ausente ou erro de acesso preservam a última leitura
válida na tela, com aviso e retry automático. Para mudar um caminho indisponível,
use **Vincular banco existente**. O limite de leitura é 32 MiB.

O plano usa `shared/today.js` nas três visualizações (web, desktop completo e
overlay): data local atual, vínculo a uma demanda existente, ordem e período.
Ações concluídas permanecem visíveis. Concluir uma demanda não conclui suas ações
planejadas automaticamente. Recorrências são geradas apenas pela interface
completa; o overlay nunca cria ciclos. A fila automática de atenção dos próximos
30 dias não é acrescentada ao plano de Hoje.

O resumo é despachado no horário local configurado ou ao iniciar/retomar depois
dele, se ainda pendente naquele dia. O registro é persistido antes da chamada da
API, garantindo no máximo uma tentativa por dia mesmo após reiniciar ou mudar o
relógio para trás. Se o processo cair entre o registro e a chamada, ou o Windows
suprimir o toast, não há nova tentativa naquele dia. Não Perturbe pode ocultar
alertas. O modelo não tem horários individuais; períodos, vencimentos e durações
não são convertidos em alarmes individuais. O processo do Persona precisa estar
rodando, mas suas janelas e o navegador podem estar fechados.

Preferências e o banco padrão ficam nos diretórios de configuração/dados do
aplicativo, normalmente `%APPDATA%\com.orizon.persona.companion`. Arquivos
vinculados permanecem onde foram escolhidos. A cópia no armazenamento do WebView
não substitui o JSON. Nada é enviado pela rede ou incorporado ao instalador.
O build copia apenas uma lista explícita de arquivos da interface; não empacota
o checkout inteiro. `.gitignore` também ignora bancos pessoais.

## Build, publicação e validação

No Windows, instale Node 22+, Rust estável com target MSVC, Visual Studio Build
Tools com **Desenvolvimento para desktop com C++** e Windows SDK. Na raiz:

```powershell
npm ci
npm test
cargo test --locked --manifest-path companion/src-tauri/Cargo.toml
npm run desktop:dev
# pasta portátil sem instalador:
npm run desktop:portable
# instalador tradicional:
npm run desktop:build -- --bundles nsis
```

Saída portátil: `companion/src-tauri/target/portable/`.
Saída NSIS: `companion/src-tauri/target/release/bundle/nsis/*-setup.exe`.
O empacotador `npm run desktop:package-portable` também pode ser executado
separadamente após um build de produção já concluído.
O workflow [Windows Persona (portable + installer)](../.github/workflows/windows-companion.yml)
executa os testes JS/Rust e gera os dois artefatos. Para distribuí-lo por link,
crie uma Release com uma tag como `persona-v0.2.1`, anexe **somente o instalador**
do artefato da mesma revisão e publique. Ele ficará em **Releases → Assets**.
O workflow não publica Releases automaticamente.

No Linux, a interface e o núcleo portátil podem ser verificados sem GTK/WebKit:

```sh
npm ci
npm test
npm run build
cargo test --locked --manifest-path companion/src-tauri/Cargo.toml
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

O teste de navegador inicia/encerra servidores nas portas 8011 e 1421. Compara
web e overlay com fixture sintética, exercita criação/conclusão na interface
Windows incorporada com ponte IPC simulada, atualizações externas, retenção e
recuperação, mudança de dia local e o shell offline da PWA. Os testes Rust usam
arquivos reais para gravação atômica, rejeição de edições desatualizadas,
truncamento/reconexão e controle de resumo sem duplicidade. A simulação não prova
a entrega de notificações ou o comportamento de janelas reais no Windows.

### Roteiro no PC

1. Encerre o companion antigo e abra esta versão pelo instalador ou por
   `Persona.exe` na pasta portátil extraída, usando uma conta sem elevação.
   Vincule uma cópia do seu banco. Cadastre, edite, planeje e conclua uma ação;
   confira o JSON e o overlay. Saia e abra novamente: os dados devem persistir.
2. Feche a janela principal. Confira o painel e reabra o Persona por ele ou pela
   bandeja, sem abrir o navegador. Teste recolher, arrastar, Sempre no topo e as
   posições após reiniciar. Confira se o desktop aparece através do painel,
   se o cursor o torna mais forte e se a opacidade escolhida volta após reiniciar.
   Teste também arrastar para outro monitor. Abrir o atalho duas vezes não deve duplicar a instância.
3. Em uma cópia de teste, escreva temporariamente `{`, restaure o conteúdo e
   depois renomeie o arquivo. Confira aviso, retenção e recuperação. Edite o JSON
   externamente com uma alteração local pendente: o editor deve recusar a gravação
   até reabrir o banco; a alteração externa não pode ser substituída silenciosamente.
4. Configure resumo para daqui a dois minutos, feche as janelas e o navegador e
   aguarde o toast. Reinicie e mude o horário: não deve repetir no mesmo dia.
   Em outro dia, abra depois do horário para testar recuperação. Verifique a troca
   do plano na meia-noite local e após suspensão do PC.
5. Ative Iniciar com Windows, faça logoff/login e confira o Persona. Desative e
   repita. Instalação, bandeja real, notificações e autostart permanecem pendentes
   de validação interativa em Windows.
