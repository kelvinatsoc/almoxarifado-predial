# Almox Predial

Sistema de almoxarifado predial pronto para hospedagem estática no GitHub Pages.

## Identidade visual Scania

A interface segue as orientações públicas da identidade Scania e do design para aplicações digitais:

- Scania Blue `#041E42` e Scania White `#FAFAFA` como cores principais;
- Scania Red `#D6001C` usado somente como destaque;
- cinzas oficiais `#53565A`, `#97999B` e `#C8C9C7`;
- composição modular, alinhada à esquerda, com hierarquia funcional;
- `Scania Sans` quando instalada e `Helvetica Neue`/`Arial` como fontes substitutas aprovadas.

O projeto não inclui uma cópia ou imitação do logotipo oficial. Caso o logotipo ou os arquivos web da Scania Sans sejam necessários, use somente os arquivos autorizados baixados pelo portal interno de marca e confirme a permissão para publicá-los em um repositório público.

Referências oficiais: [Brand Portal](https://mediaportal.scania.com/content/scania-assets/group/en/home/our-brand.html), [tipografia](https://mediaportal.scania.com/group/en/home/our-brand/brand-assets/typography.html) e [aplicações digitais](https://mediaportal.aem.devtest.aws.scania.com/content/scania-assets/group/en/home/our-brand/guidelines/digital-design.html).

## O que está incluído

- painel com valor em estoque, itens críticos e movimentações do mês;
- cadastro e edição de materiais;
- entradas e saídas com bloqueio de saldo negativo;
- estoque mínimo, alertas de reposição e item esgotado;
- busca e filtros por categoria e situação;
- histórico com solicitante, documento e observação;
- relatórios por categoria e comparação dos últimos 30 dias;
- exportação CSV, impressão, backup e restauração JSON;
- tema claro/escuro e layout responsivo;
- modo local com IndexedDB e modo compartilhado com Supabase;
- autenticação por e-mail e políticas de segurança no banco compartilhado.

## 1. Testar e publicar no GitHub Pages

O site usa módulos JavaScript. Por isso, teste com um servidor local (como a extensão **Live Server** do VS Code) ou já pelo GitHub Pages; abrir `index.html` diretamente como arquivo pode ser bloqueado pelo navegador.

Para publicar:

1. Crie um repositório no GitHub.
2. Envie **o conteúdo desta pasta** para a raiz do repositório.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main`, a pasta `/(root)` e salve.

O site funcionará imediatamente no **modo local**. Nesse modo, cada navegador tem seu próprio banco IndexedDB. Use **Configurações → Baixar backup** regularmente.

## Recomendação: publicar gratuitamente no Cloudflare Pages

Para este sistema, o Cloudflare Pages é preferível ao GitHub Pages porque aceita o ZIP pronto, fornece HTTPS e permite aplicar os cabeçalhos de segurança incluídos no arquivo `_headers`.

1. Crie uma conta gratuita em [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Abra **Workers & Pages**.
3. Selecione **Create application → Pages → Direct Upload**.
4. Defina um nome, como `almox-predial`.
5. Envie o arquivo `almoxarifado-predial.zip`.
6. Selecione **Deploy site**.

O endereço ficará semelhante a `https://almox-predial.pages.dev` e já usará HTTPS. Para atualizar o sistema depois, gere o novo ZIP e use **Create a new deployment**.

O pacote aplica política de conteúdo, bloqueio de iframe, proteção de tipos de arquivo, restrição de recursos do navegador e instruções para mecanismos de busca não indexarem o sistema.

> O endereço do site ainda poderá ser conhecido publicamente. Os dados só ficam protegidos quando o Supabase estiver configurado com autenticação e RLS. Para dados reais da Scania, obtenha antes a aprovação da área responsável por TI/Segurança da Informação. Se a própria página também precisar ficar invisível ao público, use uma hospedagem corporativa aprovada ou uma camada de acesso Zero Trust autorizada pela empresa.

## 2. Conectar o banco compartilhado Supabase

Use esta opção quando mais de uma pessoa ou computador precisar acessar o mesmo estoque.

### Criar o banco

1. Crie um projeto em [supabase.com](https://supabase.com/).
2. No projeto, abra o **SQL Editor**.
3. Copie e execute todo o arquivo [`supabase/schema.sql`](supabase/schema.sql).
4. Se quiser itens de exemplo, execute também [`supabase/demo-data.sql`](supabase/demo-data.sql).

O script cria tabelas, índices, validações, atualização automática de datas, registro transacional de movimentações e políticas de acesso para usuários autenticados.

### Criar os usuários

No painel do Supabase, abra **Authentication → Users** e crie os usuários que poderão entrar no sistema. Para um almoxarifado interno, mantenha o cadastro público desativado e crie os acessos administrativamente.

### Conectar o site

1. No painel do Supabase, copie a **Project URL** e a chave pública **anon/publishable**.
2. Abra [`js/config.js`](js/config.js).
3. Preencha:

```js
export const APP_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA-CHAVE-PUBLICA",
};
```

4. Envie a alteração ao GitHub.

Na próxima visita, o site exibirá a tela de login e usará o banco compartilhado.

> A chave `anon`/`publishable` pode estar no código público porque as políticas RLS protegem as tabelas. **Nunca** coloque a chave `service_role` no site ou no GitHub.

## 3. Uso diário

- Cadastre um item com código único, localização e estoque mínimo.
- Use **Movimentações** para toda entrada ou saída; o saldo é atualizado automaticamente.
- Corrija nome, preço, mínimo, fornecedor e localização em **Estoque → Editar**.
- O saldo de um item existente não é alterado pela edição, preservando o histórico.
- A exclusão é bloqueada quando o item já possui movimentações.
- No modo local, baixe backups JSON com frequência. No modo Supabase, use também os backups do próprio projeto.

## Estrutura

```text
almoxarifado-predial/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js
│   ├── config.js
│   └── db.js
├── assets/og-scania.png
└── supabase/
    ├── schema.sql
    └── demo-data.sql
```

## Observação sobre o GitHub Pages

O GitHub Pages hospeda apenas arquivos estáticos e não executa um servidor ou banco SQL. Por isso, este projeto oferece dois caminhos:

- **IndexedDB:** funciona sem configuração, mas os dados ficam somente naquele navegador;
- **Supabase:** banco PostgreSQL e login compartilhados, recomendado para uso real por uma equipe.
