<?php

function env_value(string $key, string $fallback = ''): string
{
    $value = getenv($key);

    return $value === false || trim($value) === '' ? $fallback : trim($value);
}

return [
    /*
     * Troque para 'blackcat' ou 'paradisepags'.
     * Futuramente o seu painel pode gravar/alterar este valor.
     */
    'active_gateway' => env_value('PIX_ACTIVE_GATEWAY', 'paradisepags'),

    'amount_cents' => (int) env_value('LOJINHA_AMOUNT_CENTS', '3819'),
    'amount_options_cents' => [3819, 4039, 4229, 4579, 4819],
    'description' => env_value('LOJINHA_DESCRIPTION', 'Produto Digital'),
    'postback_url' => env_value('PIX_POSTBACK_URL'),

    /*
     * As gateways exigem dados do cliente para criar a cobrança.
     * Ajuste estes dados conforme a sua operação/painel.
     */
    'customer' => [
        'name' => env_value('PIX_CUSTOMER_NAME', 'Cliente Lojinha'),
        'email' => env_value('PIX_CUSTOMER_EMAIL', 'cliente@lojinha.test'),
        'phone' => env_value('PIX_CUSTOMER_PHONE', '11999999999'),
        'document' => env_value('PIX_CUSTOMER_DOCUMENT', '12345678909'),
    ],

    'blackcat' => [
        'api_key' => env_value('BLACKCAT_API_KEY'),
        'base_url' => env_value('BLACKCAT_BASE_URL', 'https://api.blackcatpay.com.br/api'),
        'expires_in_days' => (int) env_value('BLACKCAT_EXPIRES_IN_DAYS', '1'),
    ],

    'paradisepags' => [
        'api_key' => 'sk_3217149c7f1e10cad6d7fe9deb40a99f9eb993957f991997f09148fcc32cde59',
        'base_url' => env_value('PARADISEPAGS_BASE_URL', 'https://multi.paradisepags.com'),
        'source' => env_value('PARADISEPAGS_SOURCE', 'api_externa'),
        'product_hash' => env_value('PARADISEPAGS_PRODUCT_HASH'),
    ],
];
