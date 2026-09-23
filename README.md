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
- **Adicionar várias** cria demandas em lote, uma para cada linha informada;
- cada demanda aceita um checklist de ações necessárias e várias anotações, cada uma com sua própria cor;
- **Amanhã** permite montar um plano de ações e vincular cada item à sua demanda;
- em **Projetos**, clique em um cartão para abrir o overview das demandas;
- bloqueios têm motivo obrigatório e podem ser resolvidos com um clique;
- `Ctrl/Cmd + K`: leva o foco para a pesquisa;
- clique em um dia do calendário para abrir o cadastro com o vencimento pronto;
- o menu lateral pode ser recolhido no desktop e mantém a preferência;
- as listas de demandas, bloqueadas e concluídas têm paginação de 10, 25 ou 50
  itens.
