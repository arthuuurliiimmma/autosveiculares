<?php

declare(strict_types=1);

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');

$config = require __DIR__ . '/config.php';
$panel = $config['panel'] ?? [];
$baseUrl = rtrim((string) ($panel['base_url'] ?? ''), '/');

if ($baseUrl === '') {
    echo "console.warn('Painel: configure PANEL_BASE_URL em api/config.php.');";
    exit;
}

$collectorUrl = $baseUrl . '/collector.js.php';
?>
(function () {
    var script = document.createElement('script');
    script.defer = true;
    script.src = <?= json_encode($collectorUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    document.head.appendChild(script);
})();
