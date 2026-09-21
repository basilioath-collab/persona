# Orizon Persona

Aplicativo pessoal, executado diretamente no navegador, para organizar demandas,
projetos, recorrências, calendário e apontamentos de tempo.

## Executar

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`. Os dados são gravados automaticamente no
`localStorage` do navegador. Use **Configurações > Exportar banco** para manter
uma cópia de segurança.

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
- `Ctrl/Cmd + K`: leva o foco para a pesquisa;
- clique em um dia do calendário para abrir o cadastro com o vencimento pronto;
- o menu lateral pode ser recolhido no desktop e mantém a preferência;
- as listas de demandas, bloqueadas e concluídas têm paginação de 10, 25 ou 50
  itens.
