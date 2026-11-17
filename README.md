# Orizon Persona

Aplicativo pessoal, executado diretamente no navegador, para organizar demandas,
projetos, recorrências, calendário, checklists, anotações coloridas e apontamentos de tempo.

## Executar

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Os dados são gravados automaticamente no
`localStorage` do navegador. Use **Configurações > Exportar banco** para manter
uma cópia de segurança.

## Painel flutuante no Chrome — sem executável

Acesse **https://basilioath-collab.github.io/persona/** no Chrome/Edge de desktop
ou abra a PWA já instalada. Clique em **Abrir painel flutuante**, no topo do
Persona. O navegador abre uma janela de Hoje que permanece sobre outras janelas,
usando Document Picture-in-Picture, sem instalar ou executar um `.exe`.

- Arraste a **barra de título do navegador** para posicionar o painel e use as
  bordas para redimensioná-lo; o tamanho e a posição são controlados pelo Chrome.
- O painel mostra o plano do dia por Manhã, Tarde e Se sobrar tempo, com duração,
  conclusão da ação e estado da demanda. Edições, conclusões, importação do banco
  e a mudança de data local atualizam o painel enquanto o Persona estiver aberto.
- Os cartões têm cores suaves em repouso e ficam destacados ao passar o mouse.
  A janela tem **fundo opaco**; o site não pode torná-la transparente sobre o
  desktop. Ela é somente leitura: **Voltar ao Persona** abre Hoje para editar.
- **Fechar painel** ou o X da janela fecha somente o painel. O mesmo botão no
  Persona permite reabri-lo; clicar novamente com ele aberto apenas o traz à
  frente. Fechar ou recarregar a guia/PWA principal também fecha o painel.
- Precisa de HTTPS (ou localhost) e de suporte do Chrome/Edge à API. Se o recurso
  estiver ausente ou bloqueado pela empresa, o Persona informa isso. Não há
  executável auxiliar nem mudança de configuração de segurança do Windows.

O Persona/Chrome precisa continuar rodando. Alertas nativos com o navegador
fechado e transparência real sobre o desktop continuam sendo recursos da versão
Windows. Se o botão ainda não aparecer após uma atualização do site, recarregue
com **Ctrl+Shift+R**; não é necessário apagar os dados do navegador.

Para testar a integração real no Chromium, execute `npm run test:floating`
(com Python 3 e Chromium disponíveis). O teste abre a janela PiP real, compara com
Hoje, edita/conclui ações, verifica mudança do dia, fechamento/reabertura, estilos
offline e mensagens para API ausente ou bloqueada. `npm run test:browser` inclui
essas verificações e a regressão da PWA e do aplicativo Windows.

## Instalar no computador

Abra o Persona pelo Chrome ou Edge e clique em **Instalar no PC**, no topo da
tela. Confirme a instalação apresentada pelo navegador. O Persona será aberto
como um aplicativo independente e poderá criar um atalho na área de trabalho,
no menu Iniciar ou na barra de tarefas, conforme as opções do sistema.

Se o navegador ainda não apresentar a confirmação automática, abra o menu `⋮`
e escolha **Instalar Orizon Persona**. A instalação exige que a página seja
servida por HTTPS ou por `localhost`; abrir o arquivo `index.html` diretamente
não habilita a instalação. Depois do primeiro carregamento, o aplicativo também
pode abrir sem conexão graças ao cache local.

## Vincular um banco

Em **Configurações > Banco de dados vinculado**, escolha uma das opções:

- **Vincular banco existente** abre um arquivo JSON já utilizado pelo Persona;
- **Criar novo banco** cria um arquivo JSON e passa a usá-lo imediatamente;
- **Reabrir / atualizar** lê novamente o conteúdo do arquivo vinculado;
- **Desvincular** deixa de atualizar o arquivo, mas preserva os dados locais.

Depois de vinculado, cada alteração feita no Persona é gravada automaticamente
no arquivo escolhido, sem API, servidor ou configuração de rede. Uma cópia
também continua no `localStorage` para permitir a abertura rápida do aplicativo.

Esse recurso utiliza a File System Access API, disponível no Chrome e no Edge.
Por segurança, o navegador pode solicitar novamente a permissão para acessar o
arquivo depois de ser fechado. O vínculo é guardado no IndexedDB do próprio
navegador e o arquivo nunca é enviado a um serviço externo.

## Atalhos e recursos

- `N`: abre o cadastro de uma nova demanda;
- `C`: abre a captura rápida;
- **Capturar** envia lembretes rápidos para a Inbox, onde podem virar demandas;
- **Adicionar várias** cria demandas em lote, uma para cada linha informada;
- cada demanda aceita um checklist de ações necessárias e várias anotações, cada uma com sua própria cor;
- **Demandas** alterna entre Lista, Kanban e visão por Prioridades;
- **Hoje** e **Amanhã** permitem montar planos por Manhã, Tarde ou Se sobrar tempo, com duração e vínculo à demanda;
- o indicador de capacidade alerta quando o dia está sobrecarregado;
- **Encerrar o dia** move as ações pendentes para amanhã;
- em **Projetos**, clique em um cartão para abrir o overview das demandas;
- bloqueios registram motivo, responsável, próxima cobrança e ação para destravar;
- o calendário combina vencimentos e ações planejadas;
- **Revisão semanal** resume execução, entregas e impedimentos dos últimos sete dias;
- `Ctrl/Cmd + K`: leva o foco para a pesquisa;
- clique em um dia do calendário para abrir o cadastro com o vencimento pronto;
- o menu lateral pode ser recolhido no desktop e mantém a preferência;
- as listas de demandas, bloqueadas e concluídas têm paginação de 10, 25 ou 50
  itens.

## Aplicativo Windows

O [Persona para Windows](companion/README.md) reúne a interface completa, o overlay
com **Meu plano de hoje**, a bandeja e os alertas nativos no **mesmo aplicativo**.
Abra apenas **Persona** para cadastrar, planejar e concluir. Ao fechar a janela
principal, ele continua na bandeja. Não é necessário abrir o navegador ou instalar
um companion separado. A versão web/PWA continua disponível.

Para baixar a versão **sem instalação**, execute **Actions → Windows Persona
(portable + installer) → Run workflow** e baixe **Persona-Portable-Windows-…**.
Extraia o ZIP e abra **Persona.exe**. O artefato **Persona-Windows-…** contém o
instalador tradicional. O guia acima explica como trazer o JSON da PWA, instalar,
testar no Windows e publicar o instalador com link direto em GitHub Releases.
