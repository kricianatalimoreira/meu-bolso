# Meu Bolso

Organizador financeiro para celular, publicado no GitHub Pages com Supabase Auth e banco protegido por RLS.

## Usar

Acesse https://kricianatalimoreira.github.io/meu-bolso/, crie sua conta, confirme o e-mail e entre. Registros são sincronizados na conta. Exporte o backup da versão anterior e importe na aba Meu plano.

## Publicação

GitHub Pages: branch main, pasta raiz. config.js contém apenas URL e chave pública publishable. Nunca coloque service_role ou senha de banco neste repositório.

## Banco

cloud-schema.sql registra a tabela e as políticas de acesso. O controle de revisão rejeita salvamentos simultâneos de aparelhos diferentes; em caso de conflito, a tela recarrega os dados antes de uma nova tentativa.
