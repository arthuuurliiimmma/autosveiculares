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

function panel_post(string $url, string $token, array $payload): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $headers = [
        'Content-Type: application/json',
        'X-Panel-Token: ' . $token,
    ];

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
        ]);

        $raw = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($raw === false) {
            throw new RuntimeException('Falha ao conectar no painel: ' . $error);
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $body,
                'timeout' => 20,
                'ignore_errors' => true,
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);
        $status = 0;

        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $header) {
                if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) {
                    $status = (int) $match[1];
                    break;
                }
            }
        }

        if ($raw === false) {
            throw new RuntimeException('Falha ao conectar no painel.');
        }
    }

    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('O painel retornou uma resposta invalida.');
    }

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException((string) ($decoded['message'] ?? 'O painel recusou a atualização.'));
    }

    return $decoded;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['success' => false, 'message' => 'Método não permitido.']);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    json_response(400, ['success' => false, 'message' => 'JSON inválido.']);
}

$panel = $config['panel'] ?? [];
$baseUrl = rtrim((string) ($panel['base_url'] ?? ''), '/');
$serverToken = trim((string) ($panel['server_token'] ?? ''));

if ($baseUrl === '' || $serverToken === '' || stripos($serverToken, 'COLE_AQUI') === 0) {
    json_response(422, ['success' => false, 'message' => 'Painel não configurado.']);
}

$payload = [
    'status' => 'copied',
    'id' => (int) ($input['panel_payment_id'] ?? $input['panel_pix_id'] ?? $input['id'] ?? 0),
    'identifier' => (string) ($input['panel_reference'] ?? $input['reference'] ?? ''),
    'transaction_id' => (string) ($input['transaction_id'] ?? ''),
];

try {
    json_response(200, panel_post($baseUrl . '/update-pix-status.php', $serverToken, $payload));
} catch (Throwable $error) {
    json_response(500, ['success' => false, 'message' => $error->getMessage()]);
}
