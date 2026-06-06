<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/config.php';

function json_response(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function only_digits(string $value): string
{
    return preg_replace('/\D+/', '', $value) ?? '';
}

function normalize_code(string $value): string
{
    $code = strtoupper(trim($value));
    $code = preg_replace('/[^A-Z0-9_-]/', '', $code) ?? '';

    return $code !== '' ? $code : 'BSF2345';
}

function amount_cents_for_code(array $config, string $code): int
{
    $amounts = [];

    foreach (($config['amount_options_cents'] ?? []) as $amount) {
        $amount = (int) $amount;

        if ($amount > 0) {
            $amounts[] = $amount;
        }
    }

    if ($amounts === []) {
        return max(0, (int) ($config['amount_cents'] ?? 3819));
    }

    $amountIndex = 0;
    $amountCount = count($amounts);
    $codeLength = strlen($code);

    for ($index = 0; $index < $codeLength; $index++) {
        $amountIndex = (($amountIndex * 31) + ord($code[$index])) % $amountCount;
    }

    return $amounts[$amountIndex];
}

function build_reference(string $code): string
{
    return 'LOJINHA-' . $code . '-' . date('YmdHis') . '-' . random_int(1000, 9999);
}

function http_json(string $url, array $headers, array $payload): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('A extensão cURL do PHP precisa estar ativa na hospedagem.');
    }

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 30,
    ]);

    $raw = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Falha ao conectar na gateway: ' . $curlError);
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        throw new RuntimeException('A gateway retornou uma resposta inválida.');
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        $message = $decoded['message'] ?? $decoded['error'] ?? 'A gateway recusou a criação do Pix.';
        throw new RuntimeException((string) $message);
    }

    return $decoded;
}

function normalized_customer(array $config): array
{
    $customer = $config['customer'] ?? [];

    return [
        'name' => (string) ($customer['name'] ?? 'Cliente Lojinha'),
        'email' => (string) ($customer['email'] ?? 'cliente@lojinha.test'),
        'phone' => only_digits((string) ($customer['phone'] ?? '11999999999')),
        'document' => only_digits((string) ($customer['document'] ?? '12345678909')),
    ];
}

function normalized_response_key(string $key): string
{
    return strtolower(preg_replace('/[^a-z0-9]+/i', '', $key) ?? '');
}

function looks_like_pix_payload(string $value): bool
{
    $value = trim($value);

    return strpos($value, '000201') === 0 || strpos(strtolower($value), 'br.gov.bcb.pix') !== false;
}

function looks_like_base64_image(string $value): bool
{
    $value = trim($value);

    if (strpos($value, 'data:image') === 0) {
        return true;
    }

    return strlen($value) > 100 && preg_match('/^[A-Za-z0-9+\/=\r\n]+$/', $value) === 1;
}

function looks_like_url(string $value): bool
{
    return filter_var(trim($value), FILTER_VALIDATE_URL) !== false;
}

function find_response_string(array $data, array $keys, callable $validator, bool $useFallback = true): string
{
    $normalizedKeys = array_flip(array_map('normalized_response_key', $keys));
    $fallback = '';

    $walk = function ($value, ?string $key = null) use (&$walk, $normalizedKeys, $validator, &$fallback): string {
        if (is_array($value)) {
            foreach ($value as $childKey => $childValue) {
                $found = $walk($childValue, is_string($childKey) ? $childKey : null);

                if ($found !== '') {
                    return $found;
                }
            }

            return '';
        }

        if (!is_scalar($value)) {
            return '';
        }

        $stringValue = trim((string) $value);

        if ($stringValue === '') {
            return '';
        }

        if ($validator($stringValue)) {
            $fallback = $fallback !== '' ? $fallback : $stringValue;

            if ($key !== null && isset($normalizedKeys[normalized_response_key($key)])) {
                return $stringValue;
            }
        }

        return '';
    };

    $found = $walk($data);

    return $found !== '' ? $found : ($useFallback ? $fallback : '');
}

function create_blackcat_pix(array $config, string $code, string $reference): array
{
    $gateway = $config['blackcat'] ?? [];
    $apiKey = trim((string) ($gateway['api_key'] ?? ''));

    if ($apiKey === '') {
        throw new RuntimeException('Configure a API Key da BlackCat em api/config.php.');
    }

    $amount = amount_cents_for_code($config, $code);
    $description = (string) ($config['description'] ?? 'Produto Digital');
    $customer = normalized_customer($config);
    $documentType = strlen($customer['document']) === 14 ? 'cnpj' : 'cpf';

    $payload = [
        'amount' => $amount,
        'currency' => 'BRL',
        'paymentMethod' => 'pix',
        'items' => [
            [
                'title' => $description,
                'unitPrice' => $amount,
                'quantity' => 1,
                'tangible' => false,
            ],
        ],
        'customer' => [
            'name' => $customer['name'],
            'email' => $customer['email'],
            'phone' => $customer['phone'],
            'document' => [
                'number' => $customer['document'],
                'type' => $documentType,
            ],
        ],
        'pix' => [
            'expiresInDays' => (int) ($gateway['expires_in_days'] ?? 1),
        ],
        'metadata' => 'Codigo: ' . $code,
        'externalRef' => $reference,
    ];

    if (!empty($config['postback_url'])) {
        $payload['postbackUrl'] = (string) $config['postback_url'];
    }

    $baseUrl = rtrim((string) ($gateway['base_url'] ?? 'https://api.blackcatpay.com.br/api'), '/');
    $response = http_json($baseUrl . '/sales/create-sale', ['X-API-Key: ' . $apiKey], $payload);
    $data = $response['data'] ?? $response;
    $paymentData = $data['paymentData'] ?? [];

    $pixCode = $paymentData['copyPaste'] ?? $paymentData['qrCode'] ?? null;
    $qrCodeBase64 = $paymentData['qrCodeBase64'] ?? null;

    if (!$pixCode || !$qrCodeBase64) {
        throw new RuntimeException('A BlackCat não retornou os dados completos do Pix.');
    }

    return [
        'success' => true,
        'gateway' => 'blackcat',
        'transaction_id' => (string) ($data['transactionId'] ?? $reference),
        'reference' => $reference,
        'pix_code' => (string) $pixCode,
        'qr_code_base64' => (string) $qrCodeBase64,
        'expires_at' => (string) ($paymentData['expiresAt'] ?? ''),
        'amount' => $amount,
    ];
}

function create_paradisepags_pix(array $config, string $code, string $reference): array
{
    $gateway = $config['paradisepags'] ?? [];
    $apiKey = trim((string) ($gateway['api_key'] ?? ''));

    if ($apiKey === '') {
        throw new RuntimeException('Configure a Secret Key da ParadisePags em api/config.php.');
    }

    $amount = amount_cents_for_code($config, $code);

    $payload = [
        'amount' => $amount,
        'description' => (string) ($config['description'] ?? 'Produto Digital'),
        'reference' => $reference,
        'source' => (string) ($gateway['source'] ?? 'api_externa'),
        'customer' => normalized_customer($config),
    ];

    if (!empty($config['postback_url'])) {
        $payload['postback_url'] = (string) $config['postback_url'];
    }

    if (!empty($gateway['product_hash'])) {
        $payload['productHash'] = (string) $gateway['product_hash'];
    }

    $baseUrl = rtrim((string) ($gateway['base_url'] ?? 'https://multi.paradisepags.com'), '/');
    $response = http_json($baseUrl . '/api/v1/transaction.php', ['X-API-Key: ' . $apiKey], $payload);

    $pixCode = find_response_string($response, [
        'qr_code',
        'qrcode',
        'qrCode',
        'pix_code',
        'pixCode',
        'copy_paste',
        'copyPaste',
        'copyPasteCode',
        'copia_e_cola',
        'brCode',
        'emv',
        'payload',
    ], 'looks_like_pix_payload');

    $qrCodeBase64 = find_response_string($response, [
        'qr_code_base64',
        'qrCodeBase64',
        'qrcode_base64',
        'qrBase64',
        'pix_qr_code_base64',
        'qrImageBase64',
        'base64',
    ], 'looks_like_base64_image');

    $qrCodeUrl = find_response_string($response, [
        'qr_code_url',
        'qrCodeUrl',
        'qrcode_url',
        'qrUrl',
        'qrImage',
        'qrImageUrl',
    ], 'looks_like_url', false);

    if ($pixCode === '') {
        $message = $response['message'] ?? 'A ParadisePags não retornou os dados completos do Pix.';
        throw new RuntimeException((string) $message);
    }

    return [
        'success' => true,
        'gateway' => 'paradisepags',
        'transaction_id' => (string) ($response['transaction_id'] ?? $response['id'] ?? $reference),
        'reference' => (string) ($response['id'] ?? $reference),
        'pix_code' => $pixCode,
        'qr_code_base64' => $qrCodeBase64,
        'qr_code_url' => $qrCodeUrl,
        'expires_at' => (string) ($response['expires_at'] ?? ''),
        'amount' => $amount,
    ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, [
        'success' => false,
        'message' => 'Método não permitido.',
    ]);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);

if (!is_array($input)) {
    json_response(400, [
        'success' => false,
        'message' => 'JSON inválido.',
    ]);
}

$gateway = strtolower((string) ($config['active_gateway'] ?? 'blackcat'));
$code = normalize_code((string) ($input['code'] ?? ''));
$reference = build_reference($code);

try {
    if ($gateway === 'blackcat') {
        $payment = create_blackcat_pix($config, $code, $reference);
    } elseif ($gateway === 'paradise' || $gateway === 'paradisepags') {
        $payment = create_paradisepags_pix($config, $code, $reference);
    } else {
        throw new RuntimeException('Gateway Pix inválida em api/config.php.');
    }

    json_response(200, $payment);
} catch (Throwable $error) {
    json_response(500, [
        'success' => false,
        'message' => $error->getMessage(),
    ]);
}
