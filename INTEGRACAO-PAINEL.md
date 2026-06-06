# Integração com o Painel

Este site foi ajustado para usar o painel em `https://painelfantasma.site`.

Antes de subir em produção, edite `api/config.php` e troque:

- `COLE_AQUI_O_TOKEN_SERVIDOR_DO_PAINEL` pelo Token servidor mostrado no botão `Integração do site`.

Fluxo integrado:

- visitas: `api/painel-tracker.php` carrega o coletor universal do painel;
- Pix: `api/criar-pix.php` chama `https://painelfantasma.site/create-payment.php` e envia o domínio do site para o filtro do dashboard;
- gateway: a ParadisePag fica configurada somente no painel;
- webhook: a ParadisePag deve continuar apontando para `https://painelfantasma.site/pix-webhook.php`.

Depois que este código estiver em todos os sites, para ativar as visitas de um novo site basta adicionar o domínio no painel.

Segurança:

- não coloque o Token servidor em JavaScript público;
- as chaves antigas de gateway foram removidas de `api/config.php`;
- rotacione as chaves antigas na Paradise/BlackCat se elas já foram enviadas em ZIP ou hospedadas publicamente.
