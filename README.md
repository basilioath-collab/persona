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

## Integração com o banco Orizon

Em **Configurações > Banco de dados Orizon**, informe a URL de um endpoint e,
se necessário, um bearer token. O endpoint deve aceitar:

- `GET`: retorna um objeto JSON com, no mínimo, a propriedade `tasks` como lista;
- `PUT`: recebe no corpo o banco completo do Persona em JSON;
- cabeçalhos `Content-Type: application/json` e `Authorization: Bearer <token>`
  (quando um token for informado).

O botão **Testar** valida o acesso sem substituir dados. **Receber do Orizon**
substitui o banco local pelo conteúdo remoto, enquanto **Enviar ao Orizon**
publica o estado local. Configure CORS no serviço para a origem em que o Persona
estiver hospedado. A URL e o token ficam armazenados apenas no navegador atual.

## Atalhos e recursos

- `N`: abre o cadastro de uma nova demanda;
- `Ctrl/Cmd + K`: leva o foco para a pesquisa;
- clique em um dia do calendário para abrir o cadastro com o vencimento pronto;
- o menu lateral pode ser recolhido no desktop e mantém a preferência;
- as listas de demandas, bloqueadas e concluídas têm paginação de 10, 25 ou 50
  itens.
