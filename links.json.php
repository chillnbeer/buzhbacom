<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, must-revalidate');

$path = __DIR__ . '/data.json';
clearstatcache(true, $path);

if (!is_readable($path)) {
  http_response_code(404);
  echo json_encode(['title'=>'@buzhba — ссылки','items'=>[]], JSON_UNESCAPED_UNICODE);
  exit;
}

readfile($path);
