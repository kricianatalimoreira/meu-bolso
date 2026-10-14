# Meu Bolso

Organizador financeiro para celular, publicado no GitHub Pages com Supabase Auth e banco protegido por RLS.

## Usar

Acesse https://kricianatalimoreira.github.io/meu-bolso/, crie sua conta, confirme o e-mail e entre. Registros são sincronizados na conta. Exporte o backup da versão anterior e importe na aba Meu plano.

## Publicação

GitHub Pages: branch main, pasta raiz. config.js contém apenas URL e chave pública publishable. Nunca coloque service_role ou senha de banco neste repositório.

## Banco

cloud-schema.sql registra a tabela e as políticas de acesso. O controle de revisão rejeita salvamentos simultâneos de aparelhos diferentes; em caso de conflito, a tela recarrega os dados antes de uma nova tentativa.

## Meu Pluggy

A aba Meu Nubank permite configurar Client ID, Client Secret e Item ID da conexão MeuPluggy na aplicação Pluggy. O usuário conecta seu banco no Meu Pluggy antes. As credenciais são enviadas por HTTPS à Edge Function e criptografadas no Supabase Vault; não ficam no repositório ou no armazenamento local do navegador.

A Edge Function meu-pluggy exige JWT válido, verifica o usuário no Supabase Auth e usa esse ID no acesso aos dados privados. Os auxiliares de credenciais só podem ser executados por service_role. A consulta suporta contas BANK em BRL e transações POSTED. As movimentações são consultadas por mês, com cache de uma hora e paginação por cursor da API v2.

A conexão do Meu Pluggy atualiza os dados bancários a cada 24 horas. O usuário consulta e revisa os lançamentos antes de adicioná-los ao orçamento. Importações reconhecem identificadores já existentes e mantêm a possibilidade de escolher categoria e pessoa. Registros manuais precisam ser revisados pelo usuário para evitar duplicidade.

A implantação da função e do banco está em supabase/functions/meu-pluggy/ e pluggy-schema.sql. O acesso ao banco real só pode ser testado depois que o titular autorizar o banco e configurar sua aplicação.
